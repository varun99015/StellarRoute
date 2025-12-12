import math

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in meters"""
    R = 6371000
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate bearing between two points in degrees"""
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlon_rad = math.radians(lon2 - lon1)
    
    y = math.sin(dlon_rad) * math.cos(lat2_rad)
    x = math.cos(lat1_rad) * math.sin(lat2_rad) - \
        math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon_rad)
    
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360) % 360