from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime
import logging
import hashlib
from typing import Dict, Any

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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="StellarRoute API",
    description="Space-weather aware navigation system with GPS failure resilience",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
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

# Store current simulation state
current_simulation = {
    "active": False,
    "scenario": None,
    "kp_index": None,
    "latitude": None,
    "longitude": None
}

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

@app.get("/api/health", response_model=HealthResponse)
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

@app.on_event("startup")
async def startup_event():
    await cache.set("api_startup", datetime.utcnow().isoformat(), ttl=3600)

@app.on_event("shutdown")
async def shutdown_event():
    await cache.clear()