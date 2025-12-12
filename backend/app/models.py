from pydantic import BaseModel, Field
from typing import List, Optional, Tuple, Literal, Dict, Any
from datetime import datetime
from enum import Enum

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class SpaceWeatherData(BaseModel):
    timestamp: datetime
    kp_index: float = Field(ge=0, le=9)
    solar_wind_speed: Optional[float] = None
    solar_wind_density: Optional[float] = None
    risk_level: RiskLevel
    estimated_gps_error_m: Tuple[float, float]
    alerts: List[str] = []
    source: str = "NOAA"

class RouteRequest(BaseModel):
    start: Tuple[float, float] = Field(..., description="[lat, lng]")
    end: Tuple[float, float] = Field(..., description="[lat, lng]")
    mode: Literal["normal", "safe"] = "normal"

class RouteResponse(BaseModel):
    route_type: str
    path: List[Tuple[float, float]]
    distance_m: float
    estimated_time_s: float
    total_risk_score: float
    max_risk_zone: RiskLevel
    # Remove waypoints or make optional
    # waypoints: List[Tuple[float, float]] = []  # REMOVE THIS LINE

class HeatmapRequest(BaseModel):
    bbox: Tuple[float, float, float, float] = Field(
        ..., 
        description="[min_lon, min_lat, max_lon, max_lat]"
    )
    resolution: float = 0.1
    
class SimulationScenario(str, Enum):
    NORMAL = "normal"
    MODERATE = "moderate"
    SEVERE = "severe"
    
class HealthResponse(BaseModel):
    status: str
    noaa_api: bool
    timestamp: datetime
    # Remove cache field since we're using memory cache