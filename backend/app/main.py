from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List

from .models import (
    SpaceWeatherData, 
    RouteRequest, 
    RouteResponse,
    HeatmapRequest,
    SimulationScenario,
    HealthResponse
)
from .services.noaa_service import NOAAWeatherService
from .services.risk_service import RiskAssessmentService
from .services.heatmap_service import HeatmapGenerator
from .services.routing_service import AStarRouter
from .utils.simulation import StormSimulator
from .cache.memory_cache import cache

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="StellarRoute API",
    description="Space-weather aware navigation system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
noaa_service = NOAAWeatherService()
risk_service = RiskAssessmentService()
heatmap_generator = HeatmapGenerator()
router = AStarRouter()
storm_simulator = StormSimulator()

# Global state
simulation_mode = False
current_scenario = SimulationScenario.NORMAL
active_connections: List[WebSocket] = []

@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to StellarRoute API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }

@app.get("/api/space-weather/current", response_model=SpaceWeatherData, tags=["Space Weather"])
async def get_current_space_weather(latitude: float = None, longitude: float = None):
    """Get current space weather"""
    try:
        if simulation_mode:
            data = storm_simulator.get_simulated_weather(current_scenario)
        else:
            data = await noaa_service.get_current_space_weather()
        
        processed_data = risk_service.process_space_weather_data(data, latitude)
        await broadcast_update("space_weather_update", processed_data.dict())
        return processed_data
        
    except Exception as e:
        logger.error(f"Error fetching space weather: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")

@app.get("/api/space-weather/simulate", response_model=SpaceWeatherData, tags=["Space Weather"])
async def simulate_space_weather(
    scenario: SimulationScenario = SimulationScenario.NORMAL,
    latitude: float = None,
    longitude: float = None
):
    """Simulate space weather"""
    try:
        global simulation_mode, current_scenario
        simulation_mode = True
        current_scenario = scenario
        
        data = storm_simulator.get_simulated_weather(scenario)
        processed_data = risk_service.process_space_weather_data(data, latitude)
        
        await broadcast_update("simulation_started", {
            "scenario": scenario.value,
            "data": processed_data.dict()
        })
        
        return processed_data
        
    except Exception as e:
        logger.error(f"Error in simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/space-weather/stop-simulation", tags=["Space Weather"])
async def stop_simulation():
    """Stop simulation"""
    global simulation_mode
    simulation_mode = False
    return {"message": "Simulation stopped", "mode": "real_data"}

@app.get("/api/space-weather/timeline", tags=["Space Weather"])
async def get_storm_timeline(scenario: SimulationScenario = SimulationScenario.MODERATE):
    """Get storm timeline"""
    timeline = storm_simulator.generate_storm_timeline(scenario)
    return {"scenario": scenario.value, "timeline": timeline}

@app.post("/api/heatmap", tags=["Heatmap"])
async def get_heatmap(request: HeatmapRequest):
    """Generate risk heatmap"""
    try:
        if simulation_mode:
            kp = storm_simulator.scenarios[current_scenario]["kp_base"]
        else:
            weather_data = await noaa_service.get_current_space_weather()
            kp = weather_data.kp_index
        
        if request.resolution > 0.5:
            # Simplified for performance
            request.resolution = 0.2
        
        heatmap = heatmap_generator.generate_heatmap(request, kp)
        
        cache_key = f"heatmap_{hash(str(request.dict()))}"
        await cache.set(cache_key, heatmap, ttl=60)
        
        return heatmap
        
    except Exception as e:
        logger.error(f"Error generating heatmap: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/route", tags=["Routing"])
async def calculate_route(request: RouteRequest):
    """Calculate routes"""
    try:
        if simulation_mode:
            kp = storm_simulator.scenarios[current_scenario]["kp_base"]
        else:
            weather_data = await noaa_service.get_current_space_weather()
            kp = weather_data.kp_index
        
        routes = router.find_routes(request, kp)
        
        if not routes:
            raise HTTPException(status_code=404, detail="No route found")
        
        route_data = routes.get(request.mode)
        if not route_data:
            route_data = routes.get("normal", routes.get("safe"))
        
        # TEMPORARY FIX: Return raw data without RouteResponse validation
        return JSONResponse(
            content={
                "route": {
                    "route_type": request.mode,
                    "path": route_data.get("path", []),
                    "distance_m": route_data.get("distance_m", 0),
                    "estimated_time_s": route_data.get("estimated_time_s", 0),
                    "total_risk_score": route_data.get("total_risk_score", 0),
                    "max_risk_zone": route_data.get("max_risk_zone", "low")
                },
                "alternatives": routes,
                "kp_index": kp,
                "simulation_mode": simulation_mode
            }
        )
        
    except Exception as e:
        logger.error(f"Error calculating route: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check"""
    try:
        # Check NOAA API
        noaa_status = False
        try:
            data = await noaa_service.fetch_kp_index()
            noaa_status = bool(data and len(data) > 0)
        except Exception as e:
            logger.error(f"NOAA API check failed: {e}")
            noaa_status = False
        
        return HealthResponse(
            status="healthy" if noaa_status else "degraded",
            noaa_api=noaa_status,
            timestamp=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="unhealthy",
            noaa_api=False,
            timestamp=datetime.utcnow()
        )

@app.websocket("/ws/updates")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time updates"""
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
    """Broadcast to WebSocket clients"""
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
    logger.info("Starting StellarRoute API...")
    await cache.clear()

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down StellarRoute API...")
    await cache.clear()