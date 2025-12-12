import requests
import json

BASE_URL = "http://localhost:8000"

def test_api():
    print("Testing StellarRoute API...\n")
    
    try:
        # 1. Test root endpoint
        print("1. Testing root endpoint...")
        response = requests.get(f"{BASE_URL}/")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}\n")
        
        # 2. Test space weather (real data)
        print("2. Testing real space weather...")
        response = requests.get(f"{BASE_URL}/api/space-weather/current")
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Kp Index: {data.get('kp_index')}")
        print(f"   Risk Level: {data.get('risk_level')}\n")
        
        # 3. Test simulation mode
        print("3. Testing simulation mode...")
        response = requests.get(f"{BASE_URL}/api/space-weather/simulate?scenario=severe")
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Simulated Kp: {data.get('kp_index')}")
        print(f"   Source: {data.get('source')}\n")
        
        # 4. Test route calculation - SIMPLE TEST FIRST
        print("4. Testing route calculation (simple)...")
        # Use points that are different enough
        route_data = {
            "start": [37.77, -122.42],
            "end": [37.78, -122.43],
            "mode": "normal"
        }
        response = requests.post(
            f"{BASE_URL}/api/route", 
            json=route_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            route = data.get('route', {})
            print(f"   ✓ Route calculated successfully!")
            print(f"   Distance: {route.get('distance_m')}m")
            print(f"   Max Risk: {route.get('max_risk_zone')}")
            print(f"   Path points: {len(route.get('path', []))}")
        else:
            print(f"   ✗ Error: {response.text[:200]}")
        print()
        
        # 5. Test health endpoint
        print("5. Testing health check...")
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            health_data = response.json()
            print(f"   ✓ Health: {health_data.get('status')}")
            print(f"   NOAA API: {health_data.get('noaa_api')}")
        else:
            print(f"   ✗ Error: {response.text[:200]}")
        print()
        
        # 6. Quick test of other endpoints
        print("6. Quick endpoint tests...")
        
        # Stop simulation
        response = requests.get(f"{BASE_URL}/api/space-weather/stop-simulation")
        print(f"   Stop simulation: {response.status_code}")
        
        # Get timeline
        response = requests.get(f"{BASE_URL}/api/space-weather/timeline?scenario=moderate")
        print(f"   Get timeline: {response.status_code}")
        
        print("\n✅ Tests completed!")
        
    except requests.exceptions.ConnectionError:
        print("❌ Error: Cannot connect to server. Make sure the server is running on http://localhost:8000")
        print("   Run: python run.py")
    except requests.exceptions.Timeout:
        print("❌ Error: Request timed out")
    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {e}")

if __name__ == "__main__":
    test_api()