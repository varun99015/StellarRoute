# STELLARROUTE - ROUND 1 TEAM TASKS (3-MONTH PROTOTYPE)
## ROUND 1 SCOPE FOCUS
Build a fully functional simulation prototype that demonstrates the entire concept in software. No hardware needed.

## ROLE 1: BACKEND DEVELOPER (Data & API)
MISSION: Create the data pipeline and routing engine
PHASE 1: Data Pipeline (Weeks 1-3)
text
TASK 1.1: NOAA Space Weather Integration
- [ ] Set up httpx async client
- [ ] Implement 2 data sources:
    1. NOAA Kp Index: https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json
    2. Solar Wind Data: https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json
- [ ] Create data models with Pydantic
- [ ] Add 5-minute caching layer

TASK 1.2: Simulation Mode Endpoint
- [ ] Create /api/simulate-storm endpoint
- [ ] Support scenarios:
    - "normal": Kp=2, low risk
    - "moderate": Kp=5, medium risk  
    - "severe": Kp=8, high risk
- [ ] Generate realistic storm timeline (ramp up/down over 2 hours)

TASK 1.3: Risk Prediction Engine
- [ ] Implement rule-based mapping:
    if Kp < 4: risk="low", error_m=5-15m
    if 4 ≤ Kp < 7: risk="medium", error_m=30-100m
    if Kp ≥ 7: risk="high", error_m=100-500m
- [ ] Add solar wind modifier: +20% error if speed > 600 km/s
PHASE 2: Heatmap Generation (Weeks 4-6)
text
TASK 1.4: GeoJSON Heatmap Generator
- [ ] Create grid system (0.1° resolution for demo area)
- [ ] For each grid cell: calculate risk score
- [ ] Generate GeoJSON FeatureCollection
- [ ] Color coding: green/yellow/red based on risk
- [ ] Endpoint: GET /api/heatmap?bbox=min_lon,min_lat,max_lon,max_lat

TASK 1.5: Performance Optimization
- [ ] Implement spatial indexing
- [ ] Add response caching (1 minute TTL)
- [ ] Create simplified version for zoomed-out views
PHASE 3: Routing Engine (Weeks 7-9)
text
TASK 1.6: A* Routing Implementation
- [ ] Create grid-based graph for demo area
- [ ] Implement A* algorithm with:
    - Manhattan distance heuristic
    - Risk-aware cost function: f(n) = g(n) + λ * risk(n)
    - λ=0.1 for normal route, λ=1.0 for safe route
- [ ] Return both routes with comparison metrics

TASK 1.7: Route Optimization
- [ ] Path smoothing (remove 90-degree turns)
- [ ] Add waypoints for natural routing
- [ ] Calculate distance, estimated time, total risk score
PHASE 4: API Layer (Weeks 10-12)
text
TASK 1.8: REST API Development
- [ ] FastAPI server with these endpoints:
    GET  /api/space-weather/current
    GET  /api/space-weather/simulate?scenario=severe
    GET  /api/heatmap
    POST /api/route {start, end, mode}
    GET  /api/health
    
TASK 1.9: WebSocket Support (Optional but recommended)
- [ ] /ws/updates for real-time space weather
- [ ] Push notifications when risk changes
- [ ] Live route updates during simulation

TASK 1.10: Deployment & Testing
- [ ] Docker container setup
- [ ] Unit tests for risk calculations
- [ ] Load testing for routing API
DELIVERABLES FOR BACKEND:
✅ Space weather fetcher with real NOAA data

✅ Simulation mode with storm scenarios

✅ Risk predictor (Kp → error meters)

✅ Heatmap generator (GeoJSON output)

✅ A* routing engine with risk penalties

✅ Complete REST API + optional WebSocket

✅ Deployed backend service

## ROLE 2: FRONTEND DEVELOPER (UI/Visualization)
MISSION: Create interactive simulation dashboard
PHASE 1: Map Foundation (Weeks 1-3)
text
TASK 2.1: React + Leaflet Setup
- [ ] Create React app with TypeScript
- [ ] Install and configure react-leaflet
- [ ] Set up OpenStreetMap tiles
- [ ] Create base map component with controls

TASK 2.2: Map Interaction System
- [ ] Draggable start/end markers
- [ ] Click-to-set waypoints
- [ ] Map bounds restriction to demo area
- [ ] Zoom/pan controls with constraints
PHASE 2: Data Visualization (Weeks 4-6)
text
TASK 2.3: Heatmap Overlay
- [ ] Fetch and display GeoJSON heatmap
- [ ] Color styling based on risk levels
- [ ] Opacity adjustment slider
- [ ] Hover tooltips with risk details

TASK 2.4: Route Visualization
- [ ] Display both normal and safe routes
- [ ] Color coding: blue (normal), green (safe)
- [ ] Route comparison panel
- [ ] Click to switch between routes
PHASE 3: Simulation Controls (Weeks 7-9)
text
TASK 2.5: Control Panel
- [ ] Space weather source toggle:
    □ Live NOAA Data
    □ Simulation Mode (with scenario selector)
- [ ] Route mode selector:
    □ Normal (fastest)
    □ Safe (storm-avoiding)
- [ ] GPS status toggle:
    □ GPS Active
    □ Simulate GPS Failure
    
TASK 2.6: Status Dashboard
- [ ] Real-time Kp index display
- [ ] Risk level indicator (color-coded)
- [ ] Estimated GPS error (meters)
- [ ] Solar wind speed display
- [ ] Data freshness indicator
PHASE 4: Vehicle Animation (Weeks 10-12)
text
TASK 2.7: Animated Vehicle Marker
- [ ] Custom SVG vehicle icon
- [ ] Smooth animation along route
- [ ] Speed control slider
- [ ] Pause/resume controls

TASK 2.8: GPS Failure Simulation
- [ ] "Simulate GPS Failure" button
- [ ] Visual indicator when GPS is lost
- [ ] Show IMU dead reckoning path
- [ ] "Restore GPS" button for resync

TASK 2.9: UI Polish & Responsiveness
- [ ] Mobile-responsive design
- [ ] Loading states and skeletons
- [ ] Error handling UI
- [ ] Dark/light mode toggle
DELIVERABLES FOR FRONTEND:
✅ Interactive map with Leaflet

✅ Heatmap overlay visualization

✅ Route drawing and comparison

✅ Animated vehicle marker

✅ Complete control panel

✅ GPS failure simulation UI

✅ Responsive, polished interface

## ROLE 3: ALGORITHMS & SIMULATION
MISSION: Implement sensor fusion and simulation logic
PHASE 1: Sensor Fusion Simulator (Weeks 1-4)
text
TASK 3.1: IMU Simulation Model
- [ ] Create IMU noise model in JavaScript:
    - Accelerometer: bias + white noise
    - Gyroscope: bias + random walk
    - Magnetometer: calibration errors
- [ ] Configurable noise levels for testing

TASK 3.2: Dead Reckoning Algorithm
- [ ] Implement position integration:
    position += velocity * Δt + 0.5 * acceleration * Δt²
- [ ] Heading estimation from gyro + magnetometer
- [ ] Velocity estimation from accelerometer
PHASE 2: GPS Simulation (Weeks 5-8)
text
TASK 3.3: GPS Error Model
- [ ] Create GPS position error generator
- [ ] Error magnitude based on risk level:
    - Low risk: 5-15m random error
    - Medium risk: 30-100m error with drift
    - High risk: 100-500m error with jumps
- [ ] Simulate satellite dropouts during storms

TASK 3.4: Sensor Fusion Logic
- [ ] Complementary filter for IMU+GPS fusion
- [ ] Simple Kalman filter implementation
- [ ] Handle GPS outages gracefully
- [ ] Resync logic when GPS returns
PHASE 3: Routing Algorithm Enhancement (Weeks 9-10)
text
TASK 3.5: Improved A* Implementation
- [ ] Optimize A* for larger grids
- [ ] Implement bidirectional search
- [ ] Add terrain/road type considerations
- [ ] Dynamic λ adjustment based on risk level

TASK 3.6: Alternative Route Generation
- [ ] Generate 3 route options:
    1. Shortest path (λ=0)
    2. Balanced (λ=0.5)
    3. Safest (λ=2.0)
- [ ] Calculate Pareto frontier
- [ ] Present trade-off analysis
PHASE 4: Integration & Testing (Weeks 11-12)
text
TASK 3.7: End-to-End Simulation
- [ ] Create demo scenarios:
    Scenario 1: Normal conditions → GPS active
    Scenario 2: Storm warning → reroute to safe path
    Scenario 3: GPS failure → IMU takes over
    Scenario 4: GPS recovery → resync to route
- [ ] Log all simulation data for analysis

TASK 3.8: Performance Metrics
- [ ] Calculate:
    - Position error during GPS outage
    - Time to destination comparison
    - Risk exposure reduction
    - Computational performance
- [ ] Generate simulation reports
DELIVERABLES FOR ALGORITHMS:
✅ IMU sensor fusion simulator (JavaScript)

✅ GPS error model based on risk

✅ Dead reckoning implementation

✅ Enhanced A* routing with risk penalties

✅ Complete simulation scenarios

✅ Performance metrics and analysis