import requests
import random
import math
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
        
        for i in range(len(path)):
            lat, lon = path[i]
            
            # Risk at this specific point
            risk = self.risk_service.calculate_grid_risk_score(kp_index, lat, lon, scenario) / 100.0
            
            total_risk += risk
            max_risk = max(max_risk, risk)
            
            if risk > 0.7: risk_segments["high"] += 1
            elif risk > 0.4: risk_segments["medium"] += 1
            else: risk_segments["low"] += 1

            if i > 0:
                prev = path[i-1]
                total_distance += haversine_distance(prev[0], prev[1], lat, lon)

        avg_risk = total_risk / len(path) if len(path) > 0 else 0
        
        if max_risk > 0.7: max_risk_zone = RiskLevel.HIGH
        elif max_risk > 0.4: max_risk_zone = RiskLevel.MEDIUM
        else: max_risk_zone = RiskLevel.LOW

        return {
            "path": path,
            "distance_m": round(total_distance, 1),
            "estimated_time_s": round(total_distance / 15.0, 1),
            "total_risk_score": round(avg_risk * 100, 1),
            "max_risk_zone": max_risk_zone,
            "avg_risk": round(avg_risk, 3),
            "risk_segments": risk_segments
        }

    def _generate_drifted_path(self, path: List[List[float]], kp_index: float) -> List[List[float]]:
        """
        Generate a 'drifted' version of the path to simulate GPS error.
        Higher Kp index = larger systematic bias + more random noise.
        """
        if not path:
            return []
            
        drifted_path = []
        
        # --- DRASTICALLY INCREASED DRIFT SCALES FOR DEMO VISIBILITY ---
        if kp_index < 4:
            # Low Risk: Minor jitter (20m)
            bias_scale = 20      
            noise_scale = 10
        elif kp_index < 7:
            # Moderate Risk: Significant drift (200m) - clearly off-road
            bias_scale = 200     
            noise_scale = 50
        else:
            # Severe Risk: Massive drift (800m) - completely wrong block/neighborhood
            bias_scale = 800    
            noise_scale = 150
            
        # Random initial direction for the "Systematic Bias" (Ionospheric shift)
        angle = random.uniform(0, 2 * math.pi)
        
        # Pre-calculate base bias in degrees (approx 111,000 meters per degree)
        base_lat_bias = (bias_scale * math.sin(angle)) / 111000
        base_lon_bias = (bias_scale * math.cos(angle)) / 111000
        
        # Apply drift to each point
        for i, (lat, lon) in enumerate(path):
            # 1. Random Noise (Jitter) per point
            lat_noise = (random.uniform(-1, 1) * noise_scale) / 111000
            lon_noise = (random.uniform(-1, 1) * noise_scale) / 111000
            
            # 2. "Wandering" Bias:
            # Instead of a constant offset, make the bias wave back and forth slowly
            # This simulates satellite geometry changing or signal multipath shifting
            # Increased frequency (i / 10.0 instead of i / 20.0) for more "wobble"
            wander_factor = math.sin(i / 10.0) * 0.5 
            
            current_lat_bias = base_lat_bias * (1 + wander_factor)
            current_lon_bias = base_lon_bias * (1 + wander_factor)
            
            new_lat = lat + current_lat_bias + lat_noise
            new_lon = lon + current_lon_bias + lon_noise
            
            drifted_path.append([new_lat, new_lon])
            
        return drifted_path

    def find_routes(self, request: RouteRequest, kp_index: float = 2.0, 
                   scenario: str = "normal") -> Dict[str, Any]:
        """Get Real Road Route, analyze risk, and generate simulations"""
        
        road_path = self.get_osrm_route(request.start, request.end)
        routes = {}
        
        if road_path:
            # NORMAL ROUTE
            normal_metrics = self.calculate_route_metrics(road_path, kp_index, scenario)
            routes["normal"] = {
                **normal_metrics,
                "optimization": "fastest_road",
                "risk_weight": 0.0
            }

            # DRIFTED ROUTE (Simulated GPS Error)
            # Only generate noticeable drift if Kp is elevated (Moderate/Severe)
            # Or always generate it but it will be small for Low Kp
            drifted_coords = self._generate_drifted_path(road_path, kp_index)
            drifted_metrics = self.calculate_route_metrics(drifted_coords, kp_index, scenario)
            
            routes["drifted"] = {
                **drifted_metrics,
                "optimization": "gps_error_simulation",
                "risk_weight": 0.0,
                "description": "Simulated GPS path based on current Kp index"
            }

            # SAFE ROUTE
            routes["safe"] = {
                **normal_metrics,
                "optimization": "safe_road",
                "risk_weight": 1.0
            }
            
            routes["imu"] = routes["normal"].copy()

        else:
            # Fallback
            logger.warning("OSRM failed, using straight line fallback")
            start, end = request.start, request.end
            fallback_path = [list(start), list(end)]
            fallback_metrics = self.calculate_route_metrics(fallback_path, kp_index, scenario)
            
            routes["normal"] = {**fallback_metrics, "optimization": "fallback"}
            routes["safe"] = {**fallback_metrics, "optimization": "fallback"}
            routes["drifted"] = {**fallback_metrics, "optimization": "fallback"}
            routes["imu"] = {**fallback_metrics, "optimization": "fallback"}

        return {
            "alternatives": routes,
            "metadata": {
                "start": request.start,
                "end": request.end,
                "source": "OSRM Public API",
                "kp_index": kp_index
            }
        }