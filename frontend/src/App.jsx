import React, { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Navigation2, Satellite } from 'lucide-react'
import MapComponent from './components/MapComponent'
import SpaceWeatherPanel from './components/SpaceWeatherPanel'
import ControlPanel from './components/ControlPanel'
import RouteComparison from './components/RouteComparison'
import { stellarRouteAPI } from './services/api'
import { GPSSimulator, VehicleAnimator } from './utils/simulation'
import { DEMO_COORDINATES } from './utils/constants'

// --- NEW IMPORT ---
import LoginModal from './components/LoginModal';

function App() {
  // --- AUTHENTICATION STATE (NEW) ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [userName, setUserName] = useState(null);
  // ---------------------------------

  // State (Existing)
  const [spaceWeather, setSpaceWeather] = useState(null)
  const [heatmapData, setHeatmapData] = useState(null)
  const [routes, setRoutes] = useState({})
  const [currentRouteMode, setCurrentRouteMode] = useState('normal')
  const [loading, setLoading] = useState(false)
  const [simulationMode, setSimulationMode] = useState(false)
  const [activePointType, setActivePointType] = useState(null);

  // Map State (Existing)
  const [mapCenter] = useState(DEMO_COORDINATES.SAN_FRANCISCO)
  const [startPoint, setStartPoint] = useState(DEMO_COORDINATES.SAN_FRANCISCO)
  const [endPoint, setEndPoint] = useState(DEMO_COORDINATES.OAKLAND)
  const [mapBounds, setMapBounds] = useState(null)

  // Simulation State (Existing)
  const [gpsActive, setGPSActive] = useState(true)
  const [vehicleMoving, setVehicleMoving] = useState(false)
  const [vehiclePosition, setVehiclePosition] = useState(null)

  // Refs (Existing)
  const gpsSimulatorRef = useRef(null)
  const vehicleAnimatorRef = useRef(null)
  const animationFrameRef = useRef(null)

  // --- AUTHENTICATION HANDLERS (NEW) ---

  /**
   * Called by LoginModal on successful OTP verification.
   * Sets the user's logged-in state and displays their email.
   */
  const handleLoginSuccess = (userDisplayName) => {
    setIsLoggedIn(true);
    setUserName(userDisplayName); // userDisplayName is the email received from FastAPI
    setShowLoginModal(false); // Close the modal
    // If the app needs user-specific data, re-fetch it here
    // fetchSpaceWeather(); 
  };

  /**
   * Clears the session cookie via the backend and resets local state.
   */
  const handleLogout = async () => {
    try {
      // Use the new logout API function which clears the HttpOnly cookie
      await stellarRouteAPI.logout();
    } catch (error) {
      console.error("Logout failed (server may be unreachable):", error);
    } finally {
      // Always clear client state regardless of server response
      setIsLoggedIn(false);
      setUserName(null);
    }
  };
  // ------------------------------------

  // Initialize (Existing)
  useEffect(() => {
    fetchSpaceWeather()
    gpsSimulatorRef.current = new GPSSimulator(startPoint)

    // Demo: Auto-calculate initial route
    setTimeout(() => {
      calculateRoute(startPoint, endPoint, 'normal')
    }, 1000)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Fetch space weather data (Existing)
  const fetchSpaceWeather = async () => {
    try {
      setLoading(true)
      const response = await stellarRouteAPI.getCurrentSpaceWeather(
        mapCenter[0],
        mapCenter[1]
      )
      setSpaceWeather(response.data)

      if (mapBounds) {
        fetchHeatmap(mapBounds)
      }
    } catch (error) {
      console.error('Error fetching space weather:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHeatmap = async (bounds) => {
    try {
      const response = await stellarRouteAPI.getHeatmap(bounds, 0.05)
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

      const routePath = data.route?.path || [start, end]
      vehicleAnimatorRef.current = new VehicleAnimator(routePath)
      setVehiclePosition(routePath[0])

      // Reset GPS simulator
      gpsSimulatorRef.current = new GPSSimulator(routePath[0])
      setGPSActive(true)
      setVehicleMoving(false)

    } catch (error) {
      console.error('Error calculating route:', error)
    } finally {
      setLoading(false)
    }
  }

  const simulateStorm = async (scenario) => {
    try {
      setLoading(true)
      const response = await stellarRouteAPI.simulateStorm(
        scenario,
        mapCenter[0],
        mapCenter[1]
      )

      setSpaceWeather(response.data)
      setSimulationMode(true)

      if (startPoint && endPoint) {
        calculateRoute(startPoint, endPoint, currentRouteMode)
      }

    } catch (error) {
      console.error('Error simulating storm:', error)
    } finally {
      setLoading(false)
    }
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


  const handleMapClick = (coords) => {
    if (!activePointType) return;

    if (activePointType === 'start') {
      setStartPoint(coords);
      // showNotification('Start point set!'); // Assuming showNotification exists
    } else {
      setEndPoint(coords);
      // showNotification('End point set!'); // Assuming showNotification exists

      if (startPoint) {
        calculateRoute(startPoint, coords, currentRouteMode);
      }
    }

    setActivePointType(null);
  };

  const handleBoundsChange = (bounds) => {
    setMapBounds(bounds)
    fetchHeatmap(bounds)
  }

  // Toggle GPS failure (Existing)
  const toggleGPSFailure = () => {
    setGPSActive(prev => !prev)

    if (gpsActive && gpsSimulatorRef.current) {
      const riskLevel = spaceWeather?.risk_level || 'medium'
      gpsSimulatorRef.current.simulateGPSFailure(riskLevel)
    } else if (!gpsActive && gpsSimulatorRef.current) {
      gpsSimulatorRef.current.restoreGPS()
    }
  }

  // Toggle vehicle movement (Existing)
  const toggleVehicleMovement = () => {
    setVehicleMoving(prev => !prev)
  }

  // Animation Loop (Existing)
  useEffect(() => {
    let animationId;

    const animate = () => {
      if (vehicleAnimatorRef.current) {
        // 1. Update REAL position based on route
        const actualPosition = vehicleAnimatorRef.current.update()

        let displayPosition = actualPosition

        // 2. Apply GPS drift if GPS is inactive
        if (!gpsActive && gpsSimulatorRef.current) {
          displayPosition = gpsSimulatorRef.current.updatePosition(
            actualPosition,
            spaceWeather?.risk_level
          )
        }

        setVehiclePosition(displayPosition)

        // 3. Continue loop if still moving
        if (vehicleAnimatorRef.current.isMoving) {
          animationId = requestAnimationFrame(animate)
        } else {
          setVehicleMoving(false)
        }
      }
    }

    if (vehicleMoving && vehicleAnimatorRef.current) {
      vehicleAnimatorRef.current.start()
      animationId = requestAnimationFrame(animate)
    } else {
      vehicleAnimatorRef.current?.pause()
      if (animationId) cancelAnimationFrame(animationId)
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [vehicleMoving, gpsActive, spaceWeather])

  const resetSimulation = () => {
    setVehicleMoving(false)
    setGPSActive(true)
    setVehiclePosition(startPoint)
    stopSimulation() // Ensure backend simulation stops too

    if (gpsSimulatorRef.current) {
      gpsSimulatorRef.current.reset()
    }

    if (vehicleAnimatorRef.current) {
      vehicleAnimatorRef.current.reset()
      vehicleAnimatorRef.current = new VehicleAnimator([startPoint, endPoint])
    }
  }

  const useDemoRoute = (routeName) => {
    let start, end
    switch (routeName) {
      case 'SF_OAKLAND':
        start = DEMO_COORDINATES.SAN_FRANCISCO
        end = DEMO_COORDINATES.OAKLAND
        break
      case 'SF_BERKELEY':
        start = DEMO_COORDINATES.SAN_FRANCISCO
        end = DEMO_COORDINATES.BERKELEY
        break
      case 'SF_SAN_JOSE':
        start = DEMO_COORDINATES.SAN_FRANCISCO
        end = DEMO_COORDINATES.SAN_JOSE
        break
      default:
        return
    }
    setStartPoint(start)
    setEndPoint(end)
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

              {/* AUTHENTICATION LOGIC START: Login/Logout Buttons */}
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
              {/* AUTHENTICATION LOGIC END */}

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
              onRouteModeChange={(mode) => {
                setCurrentRouteMode(mode)
                if (startPoint && endPoint) {
                  calculateRoute(startPoint, endPoint, mode)
                }
              }}
              gpsActive={gpsActive}
              onGPSFailureToggle={toggleGPSFailure}
              vehicleMoving={vehicleMoving}
              onVehicleMoveToggle={toggleVehicleMovement}
              onReset={resetSimulation}
              startPoint={startPoint}
              endPoint={endPoint}
              onUseDemoRoute={useDemoRoute}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="h-[600px] rounded-xl overflow-hidden shadow-xl">
              <MapComponent
                center={mapCenter}
                zoom={12}
                heatmapData={heatmapData}
                routes={routes}
                vehiclePosition={vehiclePosition}
                startPoint={startPoint}
                endPoint={endPoint}
                gpsActive={gpsActive}
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
                onSelectRoute={(mode) => {
                  setCurrentRouteMode(mode)
                  if (startPoint && endPoint) {
                    calculateRoute(startPoint, endPoint, mode)
                  }
                }}
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