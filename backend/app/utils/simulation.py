from datetime import datetime, timedelta
from typing import Dict, Any, List
import random
from ..models import SpaceWeatherData, RiskLevel, SimulationScenario

class StormSimulator:
    def __init__(self):
        self.scenarios = {
            SimulationScenario.NORMAL: {
                "kp_base": 2.0,
                "kp_variation": 0.5,
                "solar_wind": 400
            },
            SimulationScenario.MODERATE: {
                "kp_base": 5.0,
                "kp_variation": 1.0,
                "solar_wind": 550
            },
            SimulationScenario.SEVERE: {
                "kp_base": 8.0,
                "kp_variation": 0.7,
                "solar_wind": 700
            }
        }
    
    def generate_storm_timeline(self, scenario: SimulationScenario) -> List[Dict[str, Any]]:
        """Generate storm timeline"""
        config = self.scenarios[scenario]
        timeline = []
        
        now = datetime.utcnow()
        
        # Generate 12 data points
        for i in range(12):
            time = now - timedelta(minutes=10 * i)
            progress = i / 12
            
            if i < 3:
                phase = "pre_storm"
                kp = config["kp_base"] * 0.3 + random.uniform(-0.2, 0.2)
            elif i < 6:
                phase = "rising"
                kp = config["kp_base"] * (0.3 + 0.7 * (i-3)/3) + random.uniform(-0.3, 0.3)
            elif i < 9:
                phase = "peak"
                kp = config["kp_base"] + random.uniform(-config["kp_variation"], config["kp_variation"])
            else:
                phase = "recovery"
                kp = config["kp_base"] * (1 - 0.8 * (i-9)/3) + random.uniform(-0.2, 0.2)
            
            timeline.append({
                "timestamp": time.isoformat() + "Z",
                "kp_index": round(kp, 1),
                "phase": phase
            })
        
        return timeline
    
    def get_simulated_weather(self, scenario: SimulationScenario) -> SpaceWeatherData:
        """Get simulated space weather"""
        config = self.scenarios[scenario]
        
        kp = config["kp_base"] + random.uniform(-config["kp_variation"]/2, config["kp_variation"]/2)
        solar_wind = config["solar_wind"] + random.uniform(-50, 50)
        
        if kp < 4:
            risk_level = RiskLevel.LOW
            error_range = (5, 15)
        elif kp < 7:
            risk_level = RiskLevel.MEDIUM
            error_range = (30, 100)
        else:
            risk_level = RiskLevel.HIGH
            error_range = (100, 500)
        
        if solar_wind > 600:
            error_range = (error_range[0] * 1.2, error_range[1] * 1.2)
        
        return SpaceWeatherData(
            timestamp=datetime.utcnow(),
            kp_index=round(kp, 1),
            solar_wind_speed=round(solar_wind, 1),
            solar_wind_density=random.uniform(5, 10),
            risk_level=risk_level,
            estimated_gps_error_m=error_range,
            alerts=[f"Simulated {scenario.value} storm"],
            source="SIMULATION"
        )