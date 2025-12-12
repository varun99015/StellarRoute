import requests
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
from ..models import RouteRequest, RiskLevel
from .risk_service import RiskAssessmentService
from ..utils.geo_utils import haversine_distance
import logging

logger = logging.getLogger(__name__)

class RoadNetworkRouter:
    def __init__(self):
        self.risk_service = RiskAssessmentService()
        self.osrm_base_url = "http://router.project-osrm.org/route/v1/driving"

    def get_osrm_route(self, start: Tuple[float, float], end: Tuple[float, float]) -> Optional[List[List[float]]]:
        """Fetch real road geometry from OSRM public API"""
        try:
            # OSRM expects {lon},{lat}
            url = f"{self.osrm_base_url}/{start[1]},{start[0]};{end[1]},{end[0]}"
            params = {
                "overview": "full",
                "geometries": "geojson"
            }
            
            response = requests.get(url, params=params, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                if data["code"] == "Ok" and len(data["routes"]) > 0:
                    # OSRM returns [lon, lat], we need [lat, lon]
                    coordinates = data["routes"][0]["geometry"]["coordinates"]
                    return [[lat, lon] for lon, lat in coordinates]
            return None
        except Exception as e:
            logger.error(f"OSRM Fetch Error: {e}")
            return None

    def calculate_route_metrics(self, path: List[List[float]], kp_index: float, 
                              scenario: str) -> Dict[str, Any]:
        """Calculate distance, time, and risk along a specific path"""
        if not path or len(path) < 2:
            return {}

        total_distance = 0
        total_risk = 0
        max_risk = 0
        risk_segments = {"low": 0, "medium": 0, "high": 0}
        
        # Calculate metrics segment by segment
        for i in range(len(path)):
            lat, lon = path[i]
            
            # Risk at this specific point
            risk = self.risk_service.calculate_grid_risk_score(kp_index, lat, lon, scenario) / 100.0
            
            # Accumulate risk stats
            total_risk += risk
            max_risk = max(max_risk, risk)
            
            if risk > 0.7: risk_segments["high"] += 1
            elif risk > 0.4: risk_segments["medium"] += 1
            else: risk_segments["low"] += 1

            # Distance
            if i > 0:
                prev = path[i-1]
                total_distance += haversine_distance(prev[0], prev[1], lat, lon)

        avg_risk = total_risk / len(path) if len(path) > 0 else 0
        
        # Determine Max Risk Zone Label
        if max_risk > 0.7: max_risk_zone = RiskLevel.HIGH
        elif max_risk > 0.4: max_risk_zone = RiskLevel.MEDIUM
        else: max_risk_zone = RiskLevel.LOW

        return {
            "path": path,
            "distance_m": round(total_distance, 1),
            "estimated_time_s": round(total_distance / 15.0, 1), # Approx 54 km/h
            "total_risk_score": round(avg_risk * 100, 1),
            "max_risk_zone": max_risk_zone,
            "avg_risk": round(avg_risk, 3),
            "risk_segments": risk_segments
        }

    def find_routes(self, request: RouteRequest, kp_index: float = 2.0, 
                   scenario: str = "normal") -> Dict[str, Any]:
        """Get Real Road Route and analyze risk"""
        
        # 1. Fetch the actual road path from OSRM
        road_path = self.get_osrm_route(request.start, request.end)

        routes = {}
        
        if road_path:
            # NORMAL ROUTE: The actual fastest road path
            normal_metrics = self.calculate_route_metrics(road_path, kp_index, scenario)
            routes["normal"] = {
                **normal_metrics,
                "optimization": "fastest_road",
                "risk_weight": 0.0
            }

            # SAFE ROUTE
            routes["safe"] = {
                **normal_metrics,
                "optimization": "safe_road",
                "risk_weight": 1.0
            }
            
            # IMU path same as road for now
            routes["imu"] = routes["normal"].copy()

        else:
            # FALLBACK: Straight line if OSRM fails
            logger.warning("OSRM failed, using straight line fallback")
            start, end = request.start, request.end
            fallback_path = [list(start), list(end)]
            fallback_metrics = self.calculate_route_metrics(fallback_path, kp_index, scenario)
            
            routes["normal"] = {**fallback_metrics, "optimization": "fallback"}
            routes["safe"] = {**fallback_metrics, "optimization": "fallback"}
            routes["imu"] = {**fallback_metrics, "optimization": "fallback"}

        return {
            "alternatives": routes,
            "metadata": {
                "start": request.start,
                "end": request.end,
                "source": "OSRM Public API"
            }
        }