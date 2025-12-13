from datetime import datetime

from app.core.config import settings
from app.models.risk_model import RiskAssessment


class RiskService:
    @staticmethod
    def calculate_risk_score(kp_index: float, lat: float, lon: float) -> RiskAssessment:
        # Base risk from Kp index (0-9 scale to 0-100)
        base_risk = (kp_index / 9.0) * 100

        # Latitude factor: Higher latitudes (poles) have higher risk
        # Approx latitude factor: 0 at equator, 1 at poles
        lat_factor = abs(lat) / 90.0

        # Combine factors
        total_risk = base_risk * (0.5 + 0.5 * lat_factor)

        # Cap at 100
        total_risk = min(100.0, total_risk)

        # Determine risk level
        if total_risk < 20:
            level = "low"
        elif total_risk < 60:
            level = "medium"
        else:
            level = "high"

        # Calculate GPS error radius (simulated)
        # Higher Kp + High Lat = Larger error
        gps_error = (kp_index * 5) * (1 + lat_factor)

        return RiskAssessment(
            risk_score=round(total_risk, 1),
            risk_level=level,
            gps_error_radius=round(gps_error, 1),
            timestamp=datetime.now(),
        )
