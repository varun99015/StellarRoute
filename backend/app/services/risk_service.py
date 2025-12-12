from typing import Tuple
import random
from ..models import RiskLevel, SpaceWeatherData
import logging

logger = logging.getLogger(__name__)

class RiskAssessmentService:
    def __init__(self):
        self.risk_thresholds = {
            RiskLevel.LOW: (0, 3.99),
            RiskLevel.MEDIUM: (4, 6.99),
            RiskLevel.HIGH: (7, 9)
        }
        
        self.base_gps_errors = {
            RiskLevel.LOW: (5, 15),
            RiskLevel.MEDIUM: (30, 100),
            RiskLevel.HIGH: (100, 500)
        }
    
    def calculate_risk_level(self, kp_index: float, solar_wind_speed: float = None) -> RiskLevel:
        """Calculate risk level based on Kp index"""
        if kp_index < 4:
            base_risk = RiskLevel.LOW
        elif kp_index < 7:
            base_risk = RiskLevel.MEDIUM
        else:
            base_risk = RiskLevel.HIGH
        
        # Solar wind adjustment
        if solar_wind_speed and solar_wind_speed > 600:
            if base_risk == RiskLevel.LOW:
                return RiskLevel.MEDIUM
            elif base_risk == RiskLevel.MEDIUM:
                return RiskLevel.HIGH
        
        return base_risk
    
    def estimate_gps_error(self, risk_level: RiskLevel, latitude: float = None) -> Tuple[float, float]:
        """Estimate GPS error range"""
        min_error, max_error = self.base_gps_errors[risk_level]
        
        # Latitude adjustment
        if latitude is not None:
            abs_lat = abs(latitude)
            if abs_lat > 60:
                min_error *= 1.5
                max_error *= 1.5
            elif abs_lat > 45:
                min_error *= 1.2
                max_error *= 1.2
        
        # Randomness
        actual_min = min_error * (0.9 + random.random() * 0.2)
        actual_max = max_error * (0.9 + random.random() * 0.2)
        
        return (round(actual_min, 1), round(actual_max, 1))
    
    def calculate_grid_risk_score(self, kp_index: float, latitude: float, longitude: float) -> float:
        """Calculate risk score (0-100) for a grid cell"""
        base_score = (kp_index / 9) * 70
        
        # Geomagnetic effect
        geomag_factor = self._calculate_geomagnetic_factor(latitude)
        
        total_score = base_score * geomag_factor
        return min(100, total_score)
    
    def _calculate_geomagnetic_factor(self, latitude: float) -> float:
        """Calculate geomagnetic effect factor"""
        abs_lat = abs(latitude)
        if abs_lat > 70:
            return 2.0
        elif abs_lat > 50:
            return 1.5
        elif abs_lat > 30:
            return 1.2
        else:
            return 1.0
    
    def process_space_weather_data(self, data: SpaceWeatherData, latitude: float = None) -> SpaceWeatherData:
        """Process space weather data to calculate risks"""
        risk_level = self.calculate_risk_level(
            data.kp_index, 
            data.solar_wind_speed
        )
        
        error_range = self.estimate_gps_error(risk_level, latitude)
        
        data.risk_level = risk_level
        data.estimated_gps_error_m = error_range
        
        if risk_level == RiskLevel.HIGH:
            data.alerts.append("Geomagnetic storm warning - GPS degradation likely")
        elif risk_level == RiskLevel.MEDIUM and data.solar_wind_speed and data.solar_wind_speed > 600:
            data.alerts.append("Elevated solar wind - monitor GPS accuracy")
        
        return data