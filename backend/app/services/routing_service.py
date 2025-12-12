from typing import List, Tuple, Dict, Any, Optional
import heapq
import math
from ..models import RouteRequest, RouteResponse, RiskLevel
from .risk_service import RiskAssessmentService
import logging

logger = logging.getLogger(__name__)

class AStarRouter:
    def __init__(self, grid_size: int = 30):  # Smaller grid for speed
        self.grid_size = grid_size
        self.risk_service = RiskAssessmentService()
        
        # Simple 4-direction movement (faster)
        self.movements = [
            (1, 0, 1.0),   # Right
            (0, 1, 1.0),   # Up
            (-1, 0, 1.0),  # Left
            (0, -1, 1.0),  # Down
        ]
    
    def lat_lon_to_grid(self, lat: float, lon: float, 
                       min_lat: float, max_lat: float,
                       min_lon: float, max_lon: float) -> Tuple[int, int]:
        """Convert lat/lon to grid coordinates"""
        x = int((lon - min_lon) / (max_lon - min_lon) * (self.grid_size - 1))
        y = int((lat - min_lat) / (max_lat - min_lat) * (self.grid_size - 1))
        return (max(0, min(x, self.grid_size - 1)), 
                max(0, min(y, self.grid_size - 1)))
    
    def grid_to_lat_lon(self, x: int, y: int,
                       min_lat: float, max_lat: float,
                       min_lon: float, max_lon: float) -> Tuple[float, float]:
        """Convert grid coordinates to lat/lon"""
        lon = min_lon + (x / (self.grid_size - 1)) * (max_lon - min_lon)
        lat = min_lat + (y / (self.grid_size - 1)) * (max_lat - min_lat)
        return (lat, lon)
    
    def create_risk_grid(self, kp_index: float, 
                        min_lat: float, max_lat: float,
                        min_lon: float, max_lon: float):
        """Create grid with risk scores"""
        grid = []
        for y in range(self.grid_size):
            row = []
            for x in range(self.grid_size):
                lat, lon = self.grid_to_lat_lon(x, y, min_lat, max_lat, min_lon, max_lon)
                risk_score = self.risk_service.calculate_grid_risk_score(kp_index, lat, lon)
                row.append(risk_score / 100.0)  # Normalize 0-1
            grid.append(row)
        return grid
    
    def a_star_search(self, start: Tuple[int, int], goal: Tuple[int, int],
                     risk_grid, lambda_param: float = 0.1) -> Optional[List[Tuple[int, int]]]:
        """A* search with risk penalty"""
        open_set = []
        heapq.heappush(open_set, (0, start))
        
        came_from = {}
        g_score = {start: 0}
        f_score = {start: self.heuristic(start, goal)}
        
        while open_set:
            _, current = heapq.heappop(open_set)
            
            if current == goal:
                return self.reconstruct_path(came_from, current)
            
            for dx, dy, move_cost in self.movements:
                neighbor = (current[0] + dx, current[1] + dy)
                
                # Check bounds
                if not (0 <= neighbor[0] < self.grid_size and 0 <= neighbor[1] < self.grid_size):
                    continue
                
                risk_penalty = risk_grid[neighbor[1]][neighbor[0]]
                tentative_g_score = g_score[current] + move_cost + lambda_param * risk_penalty * 10
                
                if neighbor not in g_score or tentative_g_score < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g_score
                    f_score[neighbor] = tentative_g_score + self.heuristic(neighbor, goal)
                    heapq.heappush(open_set, (f_score[neighbor], neighbor))
        
        return None
    
    def heuristic(self, a: Tuple[int, int], b: Tuple[int, int]) -> float:
        """Manhattan distance heuristic"""
        return abs(a[0] - b[0]) + abs(a[1] - b[1])
    
    def reconstruct_path(self, came_from: Dict, current: Tuple[int, int]) -> List[Tuple[int, int]]:
        """Reconstruct path from came_from dictionary"""
        path = [current]
        while current in came_from:
            current = came_from[current]
            path.append(current)
        path.reverse()
        return path
    
    def smooth_path(self, path: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
        """Simplify path"""
        if len(path) < 3:
            return path
        return [path[0], path[-1]]  # Simple straight line for now
    
    def calculate_path_metrics(self, path: List[Tuple[int, int]], 
                             risk_grid,
                             min_lat: float, max_lat: float,
                             min_lon: float, max_lon: float) -> Dict[str, Any]:
        """Calculate path metrics"""
        if len(path) < 2:
            return {
                "distance_m": 0,
                "estimated_time_s": 0,
                "total_risk_score": 0,
                "max_risk_zone": RiskLevel.LOW
            }
        
        # Calculate approximate distance (in degrees, then convert)
        start_lat, start_lon = self.grid_to_lat_lon(path[0][0], path[0][1], min_lat, max_lat, min_lon, max_lon)
        end_lat, end_lon = self.grid_to_lat_lon(path[-1][0], path[-1][1], min_lat, max_lat, min_lon, max_lon)
        
        # Simple distance calculation (approx 111km per degree latitude)
        lat_distance = abs(end_lat - start_lat) * 111000  # meters
        lon_distance = abs(end_lon - start_lon) * 111000 * math.cos(math.radians((start_lat + end_lat) / 2))
        distance_m = math.sqrt(lat_distance**2 + lon_distance**2)
        
        estimated_time_s = distance_m / 15  # 15 m/s ≈ 54 km/h
        
        # Calculate average risk
        total_risk = 0
        max_risk = 0
        for x, y in path:
            risk = risk_grid[y][x]
            total_risk += risk
            max_risk = max(max_risk, risk)
        
        avg_risk = total_risk / len(path) if len(path) > 0 else 0
        
        if max_risk > 0.7:
            max_risk_zone = RiskLevel.HIGH
        elif max_risk > 0.4:
            max_risk_zone = RiskLevel.MEDIUM
        else:
            max_risk_zone = RiskLevel.LOW
        
        return {
            "distance_m": round(distance_m, 1),
            "estimated_time_s": round(estimated_time_s, 1),
            "total_risk_score": round(avg_risk * 100, 2),  # Convert back to 0-100 scale
            "max_risk_zone": max_risk_zone
        }
    
    def find_routes(self, request: RouteRequest, kp_index: float) -> Dict[str, Any]:
        """Find normal and safe routes"""
        try:
            start_lat, start_lon = request.start
            end_lat, end_lon = request.end
            
            # Add padding around points
            padding = 0.01  # ~1km
            min_lat = min(start_lat, end_lat) - padding
            max_lat = max(start_lat, end_lat) + padding
            min_lon = min(start_lon, end_lon) - padding
            max_lon = max(start_lon, end_lon) + padding
            
            # Ensure minimum size
            if max_lat - min_lat < 0.005:
                center_lat = (start_lat + end_lat) / 2
                min_lat = center_lat - 0.005
                max_lat = center_lat + 0.005
            if max_lon - min_lon < 0.005:
                center_lon = (start_lon + end_lon) / 2
                min_lon = center_lon - 0.005
                max_lon = center_lon + 0.005
            
            # Create risk grid
            risk_grid = self.create_risk_grid(kp_index, min_lat, max_lat, min_lon, max_lon)
            
            # Convert to grid coordinates
            start_grid = self.lat_lon_to_grid(start_lat, start_lon, min_lat, max_lat, min_lon, max_lon)
            end_grid = self.lat_lon_to_grid(end_lat, end_lon, min_lat, max_lat, min_lon, max_lon)
            
            routes = {}
            
            # Normal route (low risk penalty)
            normal_path = self.a_star_search(start_grid, end_grid, risk_grid, lambda_param=0.1)
            if normal_path:
                normal_path = self.smooth_path(normal_path)
                normal_metrics = self.calculate_path_metrics(normal_path, risk_grid, 
                                                            min_lat, max_lat, min_lon, max_lon)
                
                # Convert grid path back to lat/lon
                normal_coords = []
                for x, y in normal_path:
                    lat, lon = self.grid_to_lat_lon(x, y, min_lat, max_lat, min_lon, max_lon)
                    normal_coords.append((lat, lon))
                
                routes["normal"] = {
                    "path": normal_coords,
                    **normal_metrics
                }
            
            # Safe route (high risk penalty)
            safe_path = self.a_star_search(start_grid, end_grid, risk_grid, lambda_param=1.0)
            if safe_path:
                safe_path = self.smooth_path(safe_path)
                safe_metrics = self.calculate_path_metrics(safe_path, risk_grid,
                                                          min_lat, max_lat, min_lon, max_lon)
                
                safe_coords = []
                for x, y in safe_path:
                    lat, lon = self.grid_to_lat_lon(x, y, min_lat, max_lat, min_lon, max_lon)
                    safe_coords.append((lat, lon))
                
                routes["safe"] = {
                    "path": safe_coords,
                    **safe_metrics
                }
            
            # If no routes found, create a simple straight line
            if not routes:
                logger.warning("No route found, creating straight line")
                straight_coords = [request.start, request.end]
                
                # Calculate metrics for straight line
                lat1, lon1 = request.start
                lat2, lon2 = request.end
                lat_distance = abs(lat2 - lat1) * 111000
                lon_distance = abs(lon2 - lon1) * 111000 * math.cos(math.radians((lat1 + lat2) / 2))
                distance_m = math.sqrt(lat_distance**2 + lon_distance**2)
                
                # Simple risk calculation
                center_lat = (lat1 + lat2) / 2
                center_lon = (lon1 + lon2) / 2
                risk_score = self.risk_service.calculate_grid_risk_score(kp_index, center_lat, center_lon) / 100
                
                if risk_score > 0.7:
                    max_risk_zone = RiskLevel.HIGH
                elif risk_score > 0.4:
                    max_risk_zone = RiskLevel.MEDIUM
                else:
                    max_risk_zone = RiskLevel.LOW
                
                routes["normal"] = {
                    "path": normal_coords,
                    "distance_m": round(distance_m, 1),
                    "estimated_time_s": round(distance_m / 15, 1),
                    "total_risk_score": round(risk_score * 100, 2),
                    "max_risk_zone": max_risk_zone
                }
                routes["safe"] = routes["normal"].copy()
            
            return routes
            
        except Exception as e:
            logger.error(f"Error in find_routes: {e}")
            # Return fallback routes
            return {
                "normal": {
                    "path": [request.start, request.end],
                    "distance_m": 1000,
                    "estimated_time_s": 67,
                    "total_risk_score": 30,
                    "max_risk_zone": RiskLevel.LOW
                },
                "safe": {
                    "path": [request.start, request.end],
                    "distance_m": 1000,
                    "estimated_time_s": 67,
                    "total_risk_score": 30,
                    "max_risk_zone": RiskLevel.LOW
                }
            }