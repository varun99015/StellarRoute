import React, { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Navigation2, Satellite, MapPin, Target } from 'lucide-react'
import MapComponent from './components/MapComponent'
import SpaceWeatherPanel from './components/SpaceWeatherPanel'
import ControlPanel from './components/ControlPanel'
import RouteComparison from './components/RouteComparison'
import { stellarRouteAPI } from './services/api'
import { GPSSimulator, VehicleAnimator, IMUNavigator } from './utils/simulation'
import { DEMO_COORDINATES } from './utils/constants'
import LoginModal from './components/LoginModal';

function App() {
  // --- AUTHENTICATION STATE ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [userName, setUserName] = useState(null);
  
  // --- CORE STATE ---
  const [spaceWeather, setSpaceWeather] = useState(null)
  const [heatmapData, setHeatmapData] = useState(null)
  const [routes, setRoutes] = useState({})
  const [currentRouteMode, setCurrentRouteMode] = useState('normal')
  const [loading, setLoading] = useState(false)
  const [simulationMode, setSimulationMode] = useState(false)
  const [activePointType, setActivePointType] = useState(null)
  const [imuPath, setImuPath] = useState([])
  const [driftPath, setDriftPath] = useState([])

  // --- MAP STATE ---
  const [mapCenter] = useState(DEMO_COORDINATES.SAN_FRANCISCO)
  const [startPoint, setStartPoint] = useState(DEMO_COORDINATES.SAN_FRANCISCO)
  const [endPoint, setEndPoint] = useState(DEMO_COORDINATES.OAKLAND)
  const [mapBounds, setMapBounds] = useState(null)

  // --- SIMULATION STATE ---
  const [gpsActive, setGPSActive] = useState(true)
  const [vehicleMoving, setVehicleMoving] = useState(false)
  const [vehiclePosition, setVehiclePosition] = useState(null)
  const [useIMUNavigation, setUseIMUNavigation] = useState(false)
  
  // --- REFS ---
  const gpsSimulatorRef = useRef(null)
  const vehicleAnimatorRef = useRef(null)
  const imuNavigatorRef = useRef(null)
  const animationFrameRef = useRef(null)
  const lastPositionRef = useRef(null) 

  // --- AUTHENTICATION HANDLERS ---
  const handleLoginSuccess = (userDisplayName) => {
    setIsLoggedIn(true);
    setUserName(userDisplayName); 
    setShowLoginModal(false); 
  };

  const handleLogout = async () => {
    try {
      await stellarRouteAPI.logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggedIn(false);
      setUserName(null);
    }
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    fetchSpaceWeather()
    gpsSimulatorRef.current = new GPSSimulator(startPoint)
    imuNavigatorRef.current = new VehicleAnimator([startPoint])
    
    setTimeout(() => {
      calculateRoute(startPoint, endPoint, 'normal')
    }, 1000)

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  // --- API CALLS ---
  const fetchSpaceWeather = async () => {
    try {
      setLoading(true)
      const response = await stellarRouteAPI.getCurrentSpaceWeather(mapCenter[0], mapCenter[1])
      setSpaceWeather(response.data)
      if (mapBounds) fetchHeatmap(mapBounds)
    } catch (error) {
      console.error('Error fetching space weather:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHeatmap = async (bounds) => {
    try {
      const response = await stellarRouteAPI.getHeatmap(bounds, 0.02)
      setHeatmapData(response.data)
    } catch (error) {
      console.error('Error fetching heatmap:', error)
    }
  }

  const calculateRoute = async (start, end, mode = 'normal') => {
    try {
      setLoading(true)
      const response = await stellarRouteAPI.calculateRoute(start, end, mode)
      const data = response.data

      setRoutes(data.alternatives || {})
      setCurrentRouteMode(mode)

      // --- CRITICAL FIX: INITIAL PATH SELECTION ---
      // If we are in simulation mode and a drift path exists, DEFAULT to it for Normal mode.
      let initialPath = data.route?.path || [start, end];
      
      if (mode === 'normal' && simulationMode && data.alternatives?.drifted?.path) {
          console.log("Starting in Normal Mode with Active Storm: Using DRIFT Path");
          initialPath = data.alternatives.drifted.path;
      } else if (data.alternatives?.normal?.path) {
          initialPath = data.alternatives.normal.path;
      }

      // Initialize Main Animator
      if (!vehicleMoving) {
        vehicleAnimatorRef.current = new VehicleAnimator(initialPath)
        setVehiclePosition(initialPath[0])
        lastPositionRef.current = initialPath[0]
      }
      
      // Store Safe Path for IMU
      if (data.alternatives?.safe?.path) {
          setImuPath(data.alternatives.safe.path);
      }
      
    } catch (error) {
      console.error('Error calculating route:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const simulateStorm = async (scenario) => {
    try {
      setLoading(true)
      const response = await stellarRouteAPI.simulateStorm(scenario, mapCenter[0], mapCenter[1])
      setSpaceWeather(response.data)
      setSimulationMode(true)
      
      if (startPoint && endPoint) {
          calculateRoute(startPoint, endPoint, currentRouteMode)
      }
    } catch (error) { console.error(error); setLoading(false) }
  }
  
  const stopSimulation = async () => {
    try {
      await stellarRouteAPI.stopSimulation()
      setSimulationMode(false)
      fetchSpaceWeather()
    } catch (error) {
      console.error('Error stopping simulation:', error)
    }
  }

  // --- MAP INTERACTION ---
  const handleMapClick = (coords) => {
    if (!activePointType) return;
    
    if (activePointType === 'start') {
      setStartPoint(coords)
      setVehiclePosition(coords)
      lastPositionRef.current = coords
      if (endPoint) calculateRoute(coords, endPoint, currentRouteMode)
    } else if (activePointType === 'end') {
      setEndPoint(coords)
      if (startPoint) calculateRoute(startPoint, coords, currentRouteMode)
    }
    setActivePointType(null)
  }

  const handleBoundsChange = (bounds) => {
    setMapBounds(bounds)
    fetchHeatmap(bounds)
  }

  const findClosestPathIndex = (position, path) => {
    if (!position || !path || path.length === 0) return 0
    let minDist = Infinity
    let closestIndex = 0
    
    path.forEach((point, index) => {
      const dist = Math.sqrt(
        Math.pow(point[0] - position[0], 2) + 
        Math.pow(point[1] - position[1], 2)
      )
      if (dist < minDist) {
        minDist = dist
        closestIndex = index
      }
    })
    return closestIndex
  }

  // --- UNIFIED SYSTEM MODE SWITCHER ---
  const toggleSystemMode = (targetMode) => {
    const isSafeMode = targetMode === 'safe';
    
    setCurrentRouteMode(targetMode);
    
    // Determine GPS State (Safe Mode = GPS Off)
    const shouldGPSBeActive = !isSafeMode; 
    setGPSActive(shouldGPSBeActive);
    
    const currentPos = vehiclePosition || startPoint;
    lastPositionRef.current = currentPos;

    if (!shouldGPSBeActive) {
      // === SWITCHING TO SAFE MODE (IMU) ===
      // Snap to GREEN/SAFE path
      const targetPath = imuPath.length > 0 ? imuPath : (routes.safe?.path || routes.normal?.path || []);
      
      if (targetPath.length > 0) {
          const closestIndex = findClosestPathIndex(currentPos, targetPath);
          const remainingPath = targetPath.slice(closestIndex);
          imuNavigatorRef.current = new VehicleAnimator(remainingPath);
      }
      setUseIMUNavigation(true);

    } else {
      // === SWITCHING TO NORMAL MODE (GPS) ===
      // Logic: If storm is active, use DRIFTED path. If not, use NORMAL path.
      
      let targetPath = routes.normal?.path || [];
      
      // CRITICAL FIX: Explicitly check for drifted path existence
      if (simulationMode && routes.drifted?.path && routes.drifted.path.length > 0) {
          console.log("Switching to Normal Mode: Storm Active -> Engaging DRIFT Path");
          targetPath = routes.drifted.path;
      } else {
          console.log("Switching to Normal Mode: No Storm -> Engaging NORMAL Path");
      }

      if (targetPath.length > 0) {
          // Snap from current safe position to wherever we are on the GPS path
          const closestIndex = findClosestPathIndex(currentPos, targetPath);
          const remainingPath = targetPath.slice(closestIndex);
          
          // Reset main animator with the chosen path (Drifted or Normal)
          vehicleAnimatorRef.current = new VehicleAnimator(remainingPath);
      }

      if (gpsSimulatorRef.current) gpsSimulatorRef.current.restoreGPS();
      setUseIMUNavigation(false);
      setDriftPath([]); 
    }
  };

  const handleGPSFailureToggle = () => {
      const newMode = gpsActive ? 'safe' : 'normal';
      toggleSystemMode(newMode);
  };

  // Animation Loop
  useEffect(() => {
    let animationId
    const animate = () => {
      if (vehicleMoving) {
        let displayPosition;

        if (gpsActive) {
             // GPS MODE: Uses vehicleAnimator (configured to Drifted or Normal in toggleSystemMode)
             if (vehicleAnimatorRef.current) {
                 displayPosition = vehicleAnimatorRef.current.update();
             }
        } else {
             // IMU MODE: Uses imuNavigator (configured to Safe Path)
             if (imuNavigatorRef.current) {
                 displayPosition = imuNavigatorRef.current.update();
             }
        }
        
        if (displayPosition) {
            setVehiclePosition(displayPosition);
            
            const currentAnimator = gpsActive ? vehicleAnimatorRef.current : imuNavigatorRef.current;
            if (currentAnimator && !currentAnimator.isMoving) {
                 setVehicleMoving(false);
            }
        }
        
        animationId = requestAnimationFrame(animate);
      }
    }

    if (vehicleMoving) {
      if (gpsActive) vehicleAnimatorRef.current?.start();
      else imuNavigatorRef.current?.start();
      
      animationId = requestAnimationFrame(animate)
    } else {
      vehicleAnimatorRef.current?.pause()
      imuNavigatorRef.current?.pause()
      if (animationId) cancelAnimationFrame(animationId)
    }

    return () => { if (animationId) cancelAnimationFrame(animationId) }
  }, [vehicleMoving, gpsActive, useIMUNavigation])

  const resetSimulation = () => {
    setVehicleMoving(false)
    setGPSActive(true)
    setUseIMUNavigation(false)
    setDriftPath([])
    setVehiclePosition(startPoint)
    stopSimulation()
    
    lastPositionRef.current = startPoint
    
    if (gpsSimulatorRef.current) gpsSimulatorRef.current.reset()
    
    if (vehicleAnimatorRef.current) {
      vehicleAnimatorRef.current.reset()
      const route = routes.normal?.path || [startPoint, endPoint]
      vehicleAnimatorRef.current = new VehicleAnimator(route)
    }
  }

  const useDemoRoute = (routeName) => {
    let start, end
    switch (routeName) {
      case 'SF_OAKLAND': start = DEMO_COORDINATES.SAN_FRANCISCO; end = DEMO_COORDINATES.OAKLAND; break
      case 'SF_BERKELEY': start = DEMO_COORDINATES.SAN_FRANCISCO; end = DEMO_COORDINATES.BERKELEY; break
      case 'SF_SAN_JOSE': start = DEMO_COORDINATES.SAN_FRANCISCO; end = DEMO_COORDINATES.SAN_JOSE; break
      default: return
    }
    setStartPoint(start); setEndPoint(end); setVehiclePosition(start)
    calculateRoute(start, end, currentRouteMode)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Navigation2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">StellarRoute</h1>
                <p className="text-sm text-gray-600">Space-weather aware navigation system</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Satellite className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">Backend: Connected</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${spaceWeather?.risk_level === 'high' ? 'text-red-600' : 'text-yellow-600'}`} />
                  <span className="text-sm">
                    {spaceWeather ? `Kp: ${spaceWeather.kp_index}` : 'Loading...'}
                  </span>
                </div>
              </div>

              {/* AUTHENTICATION BUTTONS */}
              {isLoggedIn ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Hi, {userName || 'User'}</span>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Login (Challenge)
                </button>
              )}

              <button
                onClick={resetSimulation}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Reset Demo
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* --- POINT SELECTION MODAL --- */}
      {activePointType === 'selecting' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] animate-fade-in">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Set Point on Map</h3>
            <p className="text-gray-600 mb-6">Choose which point you want to set, then click on the map.</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => setActivePointType('start')}
                className="p-4 border-2 border-blue-100 bg-blue-50 rounded-xl hover:bg-blue-100 hover:border-blue-300 transition-all group"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-blue-500 rounded-full text-white shadow-md group-hover:scale-110 transition-transform">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-blue-700">Set Start</span>
                </div>
              </button>
              
              <button
                onClick={() => setActivePointType('end')}
                className="p-4 border-2 border-green-100 bg-green-50 rounded-xl hover:bg-green-100 hover:border-green-300 transition-all group"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-green-500 rounded-full text-white shadow-md group-hover:scale-110 transition-transform">
                    <Target className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-green-700">Set End</span>
                </div>
              </button>
            </div>
            
            <button
              onClick={() => setActivePointType(null)}
              className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* VISUAL INDICATOR FOR ACTIVE SELECTION MODE */}
      {(activePointType === 'start' || activePointType === 'end') && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[2000] bg-gray-900/90 text-white px-6 py-3 rounded-full shadow-lg backdrop-blur-sm animate-bounce-subtle flex items-center gap-3">
          {activePointType === 'start' ? (
            <MapPin className="w-5 h-5 text-blue-400" />
          ) : (
            <Target className="w-5 h-5 text-green-400" />
          )}
          <span className="font-medium">
            Click on map to set {activePointType === 'start' ? 'Start Point' : 'End Point'}
          </span>
          <button 
            onClick={() => setActivePointType(null)}
            className="ml-2 p-1 hover:bg-white/20 rounded-full"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <SpaceWeatherPanel
              spaceWeather={spaceWeather}
              onRefresh={fetchSpaceWeather}
              onSimulate={simulateStorm}
              simulationMode={simulationMode}
              loading={loading}
            />

            <ControlPanel
              routeMode={currentRouteMode}
              onRouteModeChange={toggleSystemMode}
              gpsActive={gpsActive}
              onGPSFailureToggle={handleGPSFailureToggle}
              vehicleMoving={vehicleMoving}
              onVehicleMoveToggle={() => setVehicleMoving(!vehicleMoving)}
              onReset={resetSimulation}
              onSetPoints={() => setActivePointType('selecting')}
              onClearPoints={() => { setStartPoint(null); setEndPoint(null); setRoutes({}); setVehiclePosition(null); setDriftPath([]) }}
              startPoint={startPoint}
              endPoint={endPoint}
              onUseDemoRoute={useDemoRoute}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="h-[600px] rounded-xl overflow-hidden shadow-xl relative">
              {/* Map Mask when Selecting */}
              {activePointType === 'selecting' && (
                <div className="absolute inset-0 bg-black/10 z-10 pointer-events-none" />
              )}
              
              <MapComponent
                center={mapCenter}
                zoom={12}
                heatmapData={heatmapData}
                routes={routes}
                vehiclePosition={vehiclePosition}
                startPoint={startPoint}
                endPoint={endPoint}
                gpsActive={gpsActive}
                imuPath={imuPath}
                driftPath={driftPath}
                useIMUNavigation={useIMUNavigation}
                onMapClick={handleMapClick}
                onBoundsChange={handleBoundsChange}
              />
            </div>

            <div className="mt-4 p-4 bg-white rounded-lg shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${gpsActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {gpsActive ? 'GPS: Active' : 'GPS: Failed (IMU Active)'}
                  </div>
                  <div className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {currentRouteMode === 'normal' ? 'Normal Route' : 'Storm-Safe Route'}
                  </div>
                  {simulationMode && (
                    <div className="px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                      Simulation Active
                    </div>
                  )}
                </div>

                <div className="text-sm text-gray-600">
                  {vehiclePosition && (
                    <span>Vehicle: {vehiclePosition[0].toFixed(6)}, {vehiclePosition[1].toFixed(6)}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <RouteComparison
                routes={routes}
                currentMode={currentRouteMode}
                onSelectRoute={toggleSystemMode}
              />
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-8 border-t bg-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-gray-600">
              <p className="font-medium">StellarRoute - Hackathon Project</p>
              <p className="text-sm">Space-weather aware navigation with GPS failure resilience</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                Backend: {import.meta.env.VITE_API_URL || 'http://localhost:8000'}
              </div>
              <button
                onClick={() => window.open('http://localhost:8000/docs', '_blank')}
                className="text-sm text-primary hover:text-primary/80"
              >
                API Documentation
              </button>
            </div>
          </div>
          <div className="text-xs text-center text-gray-400 mt-4">
            Note: Login status is controlled by the HttpOnly session cookie set by FastAPI.
          </div>
        </div>
      </footer>

      {/* Loading Spinner */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="font-medium">Loading...</span>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal Render */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSuccess={handleLoginSuccess}
        />
      )}
    </div>
  )
}

export default App