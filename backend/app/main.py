# StellarRoute\backend\app\main.py

import asyncio
import hashlib
import logging
import os
import random
import smtplib
import time
from datetime import datetime
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import (FastAPI, HTTPException, Request, Response, WebSocket,
                     WebSocketDisconnect, status)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr

from .cache.memory_cache import cache
# Assuming these modules exist in your project structure
from .models import (GPSFailureSimulation, HealthResponse, HeatmapRequest,
                     IMUPathRequest, RouteRequest, RouteResponse,
                     SimulationScenario, SpaceWeatherData,
                     StormSimulationRequest)
from .services.heatmap_service import HeatmapGenerator
from .services.noaa_service import NOAAWeatherService
from .services.risk_service import RiskAssessmentService
from .services.routing_service import RoadNetworkRouter
from .services.simulation import StormSimulator

# --- CONFIGURATION ---

# Load environment variables from .env file
load_dotenv()

# JWT/Session Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "a-default-secret-key-that-must-be-changed")
ALGORITHM = "HS256"
SESSION_EXPIRY_SECONDS = 30 * 60  # 30 minutes

# Email Configuration from .env
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
# Try to load port, default to 587 (STARTTLS) if not set, but code will try both.
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

# Global State/Storage
OTP_STORE: Dict[str, Dict] = {}
active_connections: List[WebSocket] = []

# Store current simulation state
current_simulation = {
    "active": False,
    "scenario": None,
    "kp_index": None,
    "latitude": None,
    "longitude": None,
}

# Setup logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="StellarRoute API",
    description="Space-weather aware navigation system with GPS failure resilience",
    version="2.0.0",
)

# CORS middleware
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
noaa_service = NOAAWeatherService()
risk_service = RiskAssessmentService()
heatmap_generator = HeatmapGenerator()
router = RoadNetworkRouter()
storm_simulator = StormSimulator()


# --- Pydantic Schemas for Authentication ---
class EmailRequest(BaseModel):
    email: EmailStr


class OtpVerification(BaseModel):
    email: EmailStr
    otp: str


# --- Authentication Utility Functions ---


def generate_otp(length: int = 6) -> str:
    """Generates a random N-digit OTP."""
    return "".join([str(random.randint(0, 9)) for _ in range(length)])


def send_email_otp(email: EmailStr, otp: str):
    """Sends an OTP via SMTP with auto-fallback between SSL and STARTTLS."""

    if not all([SMTP_SERVER, EMAIL_ADDRESS, EMAIL_PASSWORD]):
        logger.error("Email configuration missing. Cannot send email.")
        logger.info(f"DEV FALLBACK: OTP for {email} is {otp}")
        return True

    email_body = f"""
Dear User,

Your StellarRoute verification code (OTP) is:
---
{otp}
---

This code is valid for 5 minutes.

Thank you,
The StellarRoute Team
"""

    msg = MIMEText(email_body, "plain", "utf-8")
    msg["Subject"] = "StellarRoute: Your Login Code"
    msg["From"] = EMAIL_ADDRESS
    msg["To"] = email

    # Try SSL (Port 465) first, then fallback to STARTTLS (Port 587)
    try:
        # Attempt 1: SSL (Common for Gmail)
        context = smtplib.ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_SERVER, 465, context=context) as server:
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.sendmail(EMAIL_ADDRESS, [email], msg.as_string())
        logger.info(f"SUCCESS: Email sent to {email} using SSL (465)")
        return True
    except Exception as e_ssl:
        logger.warning(f"SSL (465) failed, trying STARTTLS (587). Error: {e_ssl}")
        try:
            # Attempt 2: STARTTLS
            with smtplib.SMTP(SMTP_SERVER, 587) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
                server.sendmail(EMAIL_ADDRESS, [email], msg.as_string())
            logger.info(f"SUCCESS: Email sent to {email} using STARTTLS (587)")
            return True
        except Exception as e_tls:
            logger.error(f"Failed to send email via both methods: {e_tls}")
            # Log the OTP to console as a failsafe
            logger.info(f"FAILSAFE: OTP for {email} is {otp}")
            return True


def create_session_jwt(email: str) -> str:
    """Creates a JWT for session tracking."""
    to_encode = {"sub": email, "exp": time.time() + SESSION_EXPIRY_SECONDS}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_safe_kp_index() -> float:
    """Helper to safely get Kp index, handling None values from main.py"""
    kp = current_simulation.get("kp_index")
    if kp is None:
        return 2.0
    return float(kp)


# --- AUTHENTICATION ENDPOINTS ---


@app.post(
    "/api/auth/request-otp",
    status_code=status.HTTP_202_ACCEPTED,
    tags=["Authentication"],
)
async def request_otp(request: EmailRequest):
    """Generates an OTP and sends it to the user's actual email."""

    otp_code = generate_otp()

    # Send email (logs to console if it fails)
    send_email_otp(request.email, otp_code)

    OTP_STORE[request.email] = {"otp": otp_code, "expiry": time.time() + 300}
    return {"message": "OTP sent successfully."}


@app.post("/api/auth/verify-otp", tags=["Authentication"])
async def verify_otp_and_login(request_body: OtpVerification, response: Response):
    """Verifies the OTP and creates a session cookie on success."""

    email = request_body.email
    otp_received = request_body.otp

    if email not in OTP_STORE:
        raise HTTPException(status_code=400, detail="OTP session not found or expired.")

    stored_otp_data = OTP_STORE[email]

    if time.time() > stored_otp_data["expiry"]:
        del OTP_STORE[email]
        raise HTTPException(status_code=401, detail="OTP expired.")

    if otp_received != stored_otp_data["otp"]:
        raise HTTPException(status_code=401, detail="Invalid OTP.")

    session_token = create_session_jwt(email)

    response.set_cookie(
        key="session_id",
        value=session_token,
        httponly=True,
        max_age=SESSION_EXPIRY_SECONDS,
        samesite="Lax",
    )

    del OTP_STORE[email]

    return {"message": "Login successful.", "user_email": email}


@app.get("/api/auth/status", tags=["Authentication"])
async def check_auth_status(request: Request):
    """
    Checks if the session_id cookie contains a valid JWT token.
    Used by the frontend on page load to persist login state.
    """
    token = request.cookies.get("session_id")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        # Decode and verify the JWT signature using your SECRET_KEY
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_email: str = payload.get("sub")

        if user_email is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        return {"status": "authenticated", "user_email": user_email}

    except JWTError:
        raise HTTPException(status_code=401, detail="Session expired or invalid")


@app.post("/api/auth/logout", tags=["Authentication"])
async def logout(response: Response):
    """Deletes the session cookie to log the user out."""
    response.delete_cookie(key="session_id")
    return {"message": "Logout successful"}


# --- APPLICATION ENDPOINTS ---


@app.get("/")
async def root():
    return {
        "message": "StellarRoute API v2.0",
        "status": "operational",
        "services": {
            "noaa": "active",
            "routing": "active",
            "simulation": "active",
            "cache": "active",
        },
    }


@app.get("/api/space-weather/current", response_model=SpaceWeatherData)
async def get_current_space_weather(
    latitude: float = 37.7749, longitude: float = -122.4194
):
    """Get current space weather data"""
    try:
        if current_simulation["active"]:
            scenario_enum = SimulationScenario(current_simulation["scenario"])
            weather_data = storm_simulator.get_simulated_weather(
                scenario_enum, latitude, longitude
            )
        else:
            weather_data = await noaa_service.get_current_space_weather()

        scenario = "simulation" if current_simulation["active"] else "normal"
        processed_data = risk_service.process_space_weather_data(
            weather_data, latitude, scenario
        )

        await broadcast_update("space_weather_update", processed_data.dict())
        return processed_data

    except Exception as e:
        logger.error(f"Error getting space weather: {e}")
        # Return fallback data
        return risk_service.process_space_weather_data(
            SpaceWeatherData(
                timestamp=datetime.utcnow(),
                kp_index=2.0,
                risk_level="low",
                estimated_gps_error_m=(5, 15),
                alerts=["Data fetch failed"],
                source="FALLBACK",
            ),
            latitude,
            "normal",
        )


@app.get("/api/space-weather/simulate")
async def simulate_storm(scenario: str, latitude: float, longitude: float):
    """Simulate storm conditions"""
    try:
        try:
            scenario_enum = SimulationScenario(scenario)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid scenario. Choose from: {', '.join([s.value for s in SimulationScenario])}",
            )

        current_simulation.update(
            {
                "active": True,
                "scenario": scenario,
                "latitude": latitude,
                "longitude": longitude,
            }
        )

        weather_data = storm_simulator.get_simulated_weather(
            scenario_enum, latitude, longitude
        )

        current_simulation["kp_index"] = weather_data.kp_index
        await cache.delete("route_cache_*")  # Clear route cache

        # Broadcast simulation start
        await broadcast_update(
            "simulation_started", {"scenario": scenario, "data": weather_data.dict()}
        )

        return weather_data

    except Exception as e:
        logger.error(f"Error simulating storm: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/space-weather/stop-simulation")
async def stop_simulation():
    """Stop active simulation"""
    current_simulation.update(
        {
            "active": False,
            "scenario": None,
            "kp_index": None,
            "latitude": None,
            "longitude": None,
        }
    )
    return {"message": "Simulation stopped", "status": "returned_to_real_data"}


@app.get("/api/space-weather/timeline")
async def get_storm_timeline(scenario: str = "severe"):
    """Get storm timeline"""
    try:
        scenario_enum = SimulationScenario(scenario)
        timeline = storm_simulator.generate_storm_timeline(scenario_enum)
        return {"timeline": timeline, "scenario": scenario, "duration_hours": 2}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/heatmap")
async def get_heatmap(request: HeatmapRequest):
    """Generate heatmap"""
    try:
        kp_index = get_safe_kp_index()
        heatmap = heatmap_generator.generate_heatmap(request, kp_index)
        await cache.set(f"heatmap_{hash(str(request.dict()))}", heatmap, ttl=60)
        return heatmap
    except Exception as e:
        logger.error(f"Error generating heatmap: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/route")
async def calculate_route(request: RouteRequest):
    """Calculate route using OSRM"""
    try:
        cache_key = (
            f"route_cache_{hashlib.md5(str(request.dict()).encode()).hexdigest()}"
        )
        cached = await cache.get(cache_key)
        if cached:
            return cached

        kp_index = get_safe_kp_index()
        scenario = "simulation" if current_simulation["active"] else "normal"

        logger.info(f"Calculating route with Kp: {kp_index}, Scenario: {scenario}")
        routes = router.find_routes(request, kp_index, scenario)

        await cache.set(cache_key, routes, ttl=300)
        return routes
    except Exception as e:
        logger.error(f"Error calculating route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/imu/path")
async def calculate_imu_path(request: IMUPathRequest):
    """Calculate IMU-safe path"""
    try:
        route_request = RouteRequest(start=request.start, end=request.end, mode="safe")
        kp_index = get_safe_kp_index()
        scenario = "simulation" if current_simulation["active"] else "normal"

        routes = router.find_routes(route_request, kp_index, scenario)
        alternatives = routes.get("alternatives", {})
        imu_path = alternatives.get("imu", {})

        return {
            "imu_path": imu_path.get("path", []),
            "distance_m": imu_path.get("distance_m", 0),
            "estimated_time_s": imu_path.get("estimated_time_s", 0),
            "risk_score": imu_path.get("total_risk_score", 0),
            "optimized_for": "imu_navigation",
        }
    except Exception as e:
        logger.error(f"Error calculating IMU path: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/simulation/gps-failure")
async def simulate_gps_failure(simulation: GPSFailureSimulation):
    try:
        result = storm_simulator.simulate_gps_failure(simulation)
        return {
            **result,
            "simulation_type": "gps_failure",
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error simulating GPS failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Check API health and service status"""
    try:
        # Test cache
        cache_status = await cache.ping()

        # Test NOAA service
        noaa_status = True
        try:
            await noaa_service.fetch_kp_index()
        except:
            noaa_status = False
            logger.warning("NOAA service check failed")

        return HealthResponse(
            status="healthy" if cache_status and noaa_status else "degraded",
            timestamp=datetime.utcnow(),
            services={
                "cache": cache_status,
                "noaa": noaa_status,
                "routing": True,
                "simulation": True,
                "heatmap": True,
            },
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")


@app.get("/api/status")
async def get_system_status():
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "simulation_active": current_simulation["active"],
        "services": {
            "noaa": "operational",
            "routing": "operational",
            "simulation": "operational",
        },
    }


@app.websocket("/ws/updates")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)

    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_json(
                {"type": "ping", "timestamp": datetime.utcnow().isoformat()}
            )

    except WebSocketDisconnect:
        active_connections.remove(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket in active_connections:
            active_connections.remove(websocket)


async def broadcast_update(event_type: str, data: Dict[str, Any]):
    disconnected = []

    for connection in active_connections:
        try:
            await connection.send_json(
                {
                    "type": event_type,
                    "data": data,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except:
            disconnected.append(connection)

    for connection in disconnected:
        if connection in active_connections:
            active_connections.remove(connection)


@app.on_event("startup")
async def startup_event():
    await cache.set("api_startup", datetime.utcnow().isoformat(), ttl=3600)


@app.on_event("shutdown")
async def shutdown_event():
    await cache.clear()
