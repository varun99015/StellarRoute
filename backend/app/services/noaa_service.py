import httpx
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List
import logging
from ..cache.memory_cache import cache
from ..models import SpaceWeatherData, RiskLevel

logger = logging.getLogger(__name__)

class NOAAWeatherService:
    def __init__(self):
        self.base_url = "https://services.swpc.noaa.gov"
        self.timeout = 10.0
        
    async def fetch_kp_index(self) -> List[Dict[str, Any]]:
        """Fetch Kp index data from NOAA"""
        url = f"{self.base_url}/products/noaa-planetary-k-index.json"
        cache_key = "noaa_kp_data"
        
        cached = await cache.get(cache_key)
        if cached:
            return cached
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                await cache.set(cache_key, data, ttl=300)
                return data
        except Exception as e:
            logger.error(f"Error fetching Kp data: {e}")
            return self._generate_simulated_kp_data()
    
    async def fetch_solar_wind(self) -> List[Dict[str, Any]]:
        """Fetch solar wind data from NOAA"""
        url = f"{self.base_url}/products/solar-wind/plasma-7-day.json"
        cache_key = "noaa_solar_wind_data"
        
        cached = await cache.get(cache_key)
        if cached:
            return cached
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                await cache.set(cache_key, data, ttl=300)
                return data
        except Exception as e:
            logger.error(f"Error fetching solar wind: {e}")
            return []
    
    def _generate_simulated_kp_data(self) -> List[List]:
        """Generate simulated Kp data as fallback"""
        now = datetime.utcnow()
        simulated_data = []
        
        for i in range(24):
            timestamp = (now - timedelta(hours=i)).isoformat() + "Z"
            kp_value = 2.3 + (i % 3) * 0.7
            simulated_data.append([timestamp, kp_value])
        
        return simulated_data
    
    async def get_current_space_weather(self) -> SpaceWeatherData:
        """Get current space weather conditions"""
        try:
            kp_data = await self.fetch_kp_index()
            solar_wind_data = await self.fetch_solar_wind()
            
            # Get latest Kp value
            if kp_data and len(kp_data) > 1:
                latest_kp = float(kp_data[-1][1]) if kp_data[-1][1] else 2.0
            else:
                latest_kp = 2.0
            
            # Get solar wind speed
            solar_wind_speed = None
            if solar_wind_data and len(solar_wind_data) > 1:
                try:
                    solar_wind_speed = float(solar_wind_data[-1][1])
                except:
                    solar_wind_speed = 400.0
            
            return SpaceWeatherData(
                timestamp=datetime.utcnow(),
                kp_index=latest_kp,
                solar_wind_speed=solar_wind_speed,
                solar_wind_density=None,
                risk_level=RiskLevel.LOW,  # Will be calculated by risk service
                estimated_gps_error_m=(5, 15),
                alerts=[],
                source="NOAA"
            )
        except Exception as e:
            logger.error(f"Error getting space weather: {e}")
            # Return default data
            return SpaceWeatherData(
                timestamp=datetime.utcnow(),
                kp_index=2.0,
                solar_wind_speed=400.0,
                solar_wind_density=5.0,
                risk_level=RiskLevel.LOW,
                estimated_gps_error_m=(5, 15),
                alerts=["Using simulated data - NOAA API failed"],
                source="SIMULATION"
            )