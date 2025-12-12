from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from jose import jwt, JWTError
from email.mime.text import MIMEText 
import smtplib 
from dotenv import load_dotenv 
import os 
import asyncio
import logging
from datetime import datetime
import random
import time
import hashlib
from typing import Dict, Any, List

# Assuming these modules exist in your project structure
from .models import (
    SpaceWeatherData, HeatmapRequest, RouteRequest, RouteResponse,
    StormSimulationRequest, GPSFailureSimulation, IMUPathRequest,
    HealthResponse, SimulationScenario
)
from .services.noaa_service import NOAAWeatherService
from .services.risk_service import RiskAssessmentService
from .services.heatmap_service import HeatmapGenerator
from .services.routing_service import RoadNetworkRouter
from .services.simulation import StormSimulator
from .cache.memory_cache import cache


# --- CONFIGURATION ---

# Load environment variables from .env file
load_dotenv() 

# JWT/Session Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "a-default-secret-key-that-must-be-changed") 
ALGORITHM = "HS256"
SESSION_EXPIRY_SECONDS = 30 * 60 # 30 minutes

# Email Configuration from .env
SMTP_SERVER = os.getenv("SMTP_SERVER")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

# Global State/Storage
OTP_STORE: Dict[str, Dict] = {} # Simulates OTP database storage
active_connections: List[WebSocket] = []

# Store current simulation state
current_simulation = {
    "active": False,
    "scenario": None,
    "kp_index": None,
    "latitude": None,
    "longitude": None
}

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="StellarRoute API",
    description="Space-weather aware navigation system with GPS failure resilience",
    version="2.0.0"
)

# CORS middleware (Combined for both ports)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
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
# FIX: Use the RoadNetworkRouter for real roads
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
    """ACTUAL function to send an OTP via SMTP (using STARTTLS on 587)."""
    
    if not all([SMTP_SERVER, EMAIL_ADDRESS, EMAIL_PASSWORD]):
        logger.error("Email configuration missing. Cannot send email.")
        raise HTTPException(status_code=500, detail="Server misconfigured: Email credentials missing.")

    email_body = f"""
Dear User,

Your StellarRoute verification code (OTP) is:
---
{otp}
---

This code is valid for 5 minutes and is required to complete your login. If you did not request this code, please ignore this email.

Thank you,
The StellarRoute Team
"""
    
    msg = MIMEText(email_body, 'plain', 'utf-8')
    msg['Subject'] = 'StellarRoute: Your One-Time Login Code'
    msg['From'] = EMAIL_ADDRESS
    msg['To'] = email

    try:
        # Use SMTP for connection on the STARTTLS port (587)
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT) 
        server.ehlo()
        server.starttls() 
        server.ehlo()

        server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        
        server.sendmail(EMAIL_ADDRESS, [email], msg.as_string())
        
        server.quit()
        logger.info(f"SUCCESS: Actual OTP sent to {email}")
        return True
    
    except smtplib.SMTPAuthenticationError:
        logger.error("SMTP Authentication Failed. Check EMAIL_ADDRESS and EMAIL_PASSWORD (use App Password).")
        raise HTTPException(status_code=500, detail="Authentication error with the email provider.")
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        raise HTTPException(status_code=500, detail="Could not connect to or send mail from the SMTP server. Check port/firewall.")
    
def create_session_jwt(email: str) -> str:
    """Creates a JWT for session tracking."""
    to_encode = {"sub": email, "exp": time.time() + SESSION_EXPIRY_SECONDS}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# --- AUTHENTICATION ENDPOINTS ---

@app.post("/api/auth/request-otp", status_code=status.HTTP_202_ACCEPTED, tags=["Authentication"])
async def request_otp(request: EmailRequest):
    """Generates an OTP and sends it to the user's actual email."""
    
    otp_code = generate_otp()
    
    # Attempt to send the email (will raise HTTPException on failure)
    send_email_otp(request.email, otp_code)
    
    # Store OTP only if the email was successfully dispatched
    OTP_STORE[request.email] = {
        "otp": otp_code, 
        "expiry": time.time() + 300 # 5 minutes
    }
    return {"message": "OTP sent successfully. Check your inbox."}


@app.post("/api/auth/verify-otp", tags=["Authentication"])
async def verify_otp_and_login(request_body: OtpVerification, response: Response):
    """Verifies the OTP and creates a session cookie on success."""
    
    email = request_body.email
    otp_received = request_body.otp
    
    if email not in OTP_STORE:
        raise HTTPException(status_code=400, detail="OTP session not found or expired. Request a new one.")

    stored_otp_data = OTP_STORE[email]
    
    if time.time() > stored_otp_data["expiry"]:
        del OTP_STORE[email]
        raise HTTPException(status_code=401, detail="OTP expired. Request a new one.")
        
    if otp_received != stored_otp_data["otp"]:
        raise HTTPException(status_code=401, detail="Invalid OTP.")

    # SUCCESS: Generate Session Token (JWT)
    session_token = create_session_jwt(email)

    # Set the Session Cookie (FIXED TYPO: httponly=True)
    response.set_cookie(
        key="session_id", 
        value=session_token, 
        httponly=True,           
        max_age=SESSION_EXPIRY_SECONDS, 
        # secure=True, 
        samesite="Lax" 
    )
    
    del OTP_STORE[email] # OTP used, delete it

    return {"message": "Login successful. Session created.", "user_email": email}

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
            "cache": "active"
        }
    }

@app.get("/api/space-weather/current", response_model=SpaceWeatherData)
async def get_current_space_weather(latitude: float = 37.7749, longitude: float = -122.4194):
    """Get current space weather data"""
    try:
        if current_simulation["active"]:
            scenario_enum = SimulationScenario(current_simulation["scenario"])
            weather_data = storm_simulator.get_simulated_weather(
                scenario_enum,
                latitude,
                longitude
            )
        else:
            weather_data = await noaa_service.get_current_space_weather()
        
        scenario = "simulation" if current_simulation["active"] else "normal"
        processed_data = risk_service.process_space_weather_data(
            weather_data,
            latitude,
            scenario
        )
        
        await broadcast_update("space_weather_update", processed_data.dict())
        return processed_data
        
    except Exception as e:
        logger.error(f"Error getting space weather: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/space-weather/simulate")
async def simulate_storm(scenario: str, latitude: float, longitude: float):
    """Simulate storm conditions"""
    try:
        try:
            scenario_enum = SimulationScenario(scenario)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid scenario. Choose from: {', '.join([s.value for s in SimulationScenario])}")
        
        current_simulation.update({
            "active": True,
            "scenario": scenario,
            "latitude": latitude,
            "longitude": longitude
        })
        
        weather_data = storm_simulator.get_simulated_weather(
            scenario_enum,
            latitude,
            longitude
        )
        
        current_simulation["kp_index"] = weather_data.kp_index
        await cache.delete("route_cache_*") # Clear route cache
        
        # Broadcast simulation start
        await broadcast_update("simulation_started", {
            "scenario": scenario,
            "data": weather_data.dict()
        })
        
        return weather_data
        
    except Exception as e:
        logger.error(f"Error simulating storm: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/space-weather/stop-simulation")
async def stop_simulation():
    """Stop active simulation"""
    current_simulation.update({
        "active": False,
        "scenario": None,
        "kp_index": None,
        "latitude": None,
        "longitude": None
    })
    return {"message": "Simulation stopped", "status": "returned_to_real_data"}

@app.get("/api/space-weather/timeline")
async def get_storm_timeline(scenario: str = "severe"):
    """Get storm timeline"""
    try:
        scenario_enum = SimulationScenario(scenario)
        timeline = storm_simulator.generate_storm_timeline(scenario_enum)
        return {
            "timeline": timeline,
            "scenario": scenario,
            "duration_hours": 2
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/heatmap")
async def get_heatmap(request: HeatmapRequest):
    """Generate heatmap"""
    try:
        kp_index = current_simulation.get("kp_index")
        if kp_index is None:
            weather_data = await noaa_service.get_current_space_weather()
            kp_index = weather_data.kp_index
        
        heatmap = heatmap_generator.generate_heatmap(request, kp_index)
        
        # Basic caching for heatmap
        cache_key = f"heatmap_{hash(str(request.dict()))}"
        await cache.set(cache_key, heatmap, ttl=60)
        
        return heatmap
    except Exception as e:
        logger.error(f"Error generating heatmap: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/route")
async def calculate_route(request: RouteRequest):
    """Calculate route using OSRM"""
    try:
        cache_key = f"route_cache_{hashlib.md5(str(request.dict()).encode()).hexdigest()}"
        cached = await cache.get(cache_key)
        if cached:
            return cached
        
        kp_index = current_simulation.get("kp_index", 2.0)
        scenario = "simulation" if current_simulation["active"] else "normal"
        
        routes = router.find_routes(request, kp_index, scenario)
        
        await cache.set(cache_key, routes, ttl=300)
        return routes
    except Exception as e:
        logger.error(f"Error calculating route: {e}")
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
                "heatmap": True
            }
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")

@app.post("/api/imu/path")
async def calculate_imu_path(request: IMUPathRequest):
    """Calculate IMU-safe path"""
    try:
        route_request = RouteRequest(
            start=request.start,
            end=request.end,
            mode="safe"
        )
        kp_index = current_simulation.get("kp_index", 2.0)
        scenario = "simulation" if current_simulation["active"] else "normal"
        
        routes = router.find_routes(route_request, kp_index, scenario)
        alternatives = routes.get("alternatives", {})
        imu_path = alternatives.get("imu", {})
        
        return {
            "imu_path": imu_path.get("path", []),
            "distance_m": imu_path.get("distance_m", 0),
            "estimated_time_s": imu_path.get("estimated_time_s", 0),
            "risk_score": imu_path.get("total_risk_score", 0),
            "optimized_for": "imu_navigation"
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
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error simulating GPS failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/status")
async def get_system_status():
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "simulation_active": current_simulation["active"],
        "services": {
            "noaa": "operational",
            "routing": "operational",
            "simulation": "operational"
        }
    }

@app.websocket("/ws/updates")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_json({"type": "ping", "timestamp": datetime.utcnow().isoformat()})
            
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
            await connection.send_json({
                "type": event_type,
                "data": data,
                "timestamp": datetime.utcnow().isoformat()
            })
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