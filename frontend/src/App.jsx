import React, { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Navigation2, Satellite, MapPin, Target, Wifi } from 'lucide-react'
import MapComponent from './components/MapComponent'
import SpaceWeatherPanel from './components/SpaceWeatherPanel'
import ControlPanel from './components/ControlPanel'
import RouteComparison from './components/RouteComparison'
import SolarStormGlobe from './components/SolarStormGlobe' // <--- NEW IMPORT
import { stellarRouteAPI } from './services/api'
import { GPSSimulator, VehicleAnimator, IMUNavigator } from './utils/simulation'
import { DEMO_COORDINATES } from './utils/constants'
import LoginModal from './components/LoginModal';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";
import { firebaseConfig } from './firebaseConfig'; 

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

function App() {
  // --- AUTHENTICATION STATE ---
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('stellar_isLoggedIn') === 'true';
  });
  
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('stellar_userName');
  });

  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // --- REAL-TIME SENSOR STATE ---
  const [realTimeMode, setRealTimeMode] = useState(false);
  const [lastSensorTime, setLastSensorTime] = useState(0);

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
  const lastPositionRef = useRef(null) 

  // --- PERSISTENCE EFFECT ---
  useEffect(() => {
    localStorage.setItem('stellar_isLoggedIn', isLoggedIn);
    if (userName) {
      localStorage.setItem('stellar_userName', userName);
    } else {
      localStorage.removeItem('stellar_userName');
    }
  }, [isLoggedIn, userName]);

  // --- MATH HELPER FOR REAL-TIME ---
  const calculateNewPosition = (currentLat, currentLon, sensorData, prevTime) => {
      const R = 6371e3;
      const now = sensorData.timestamp;
      const dt = prevTime === 0 ? 0.1 : (now - prevTime) / 1000;
      
      if (dt > 2.0 || dt < 0) return { lat: currentLat, lon: currentLon, timestamp: now };

      const speed = (sensorData.speed || 0) / 3.6;
      const d = speed * dt;
      const brng = (sensorData.heading || 0) * Math.PI / 180;
      
      const lat1 = currentLat * Math.PI / 180;
      const lon1 = currentLon * Math.PI / 180;

      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d/R) +
                  Math.cos(lat1) * Math.sin(d/R) * Math.cos(brng));
      
      const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d/R) * Math.cos(lat1),
                           Math.cos(d/R) - Math.sin(lat1) * Math.sin(lat2));

      return {
          lat: lat2 * 180 / Math.PI,
          lon: lon2 * 180 / Math.PI,
          timestamp: now
      };
  }

  // --- FIREBASE LISTENER ---
  useEffect(() => {
    if (realTimeMode) {
        console.log("📡 Subscribing to Firebase vehicle_control...");
        const sensorRef = ref(db, 'vehicle_control');
        
        const unsubscribe = onValue(sensorRef, (snapshot) => {
            const data = snapshot.val();
            
            if (data && lastPositionRef.current) {
                const newPos = calculateNewPosition(
                    lastPositionRef.current[0],
                    lastPositionRef.current[1],
                    data,
                    lastSensorTime
                );
                
                setLastSensorTime(newPos.timestamp);
                setVehiclePosition([newPos.lat, newPos.lon]);
                lastPositionRef.current = [newPos.lat, newPos.lon];
                
                setDriftPath(prev => {
                    const newPath = [...prev, [newPos.lat, newPos.lon]];
                    if (newPath.length > 500) return newPath.slice(newPath.length - 500);
                    return newPath;
                });
            }
        });
        
        return () => unsubscribe();
    }
  }, [realTimeMode, lastSensorTime]);

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
      localStorage.clear(); 
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
  }, [])

  // --- API CALLS ---
  const fetchSpaceWeather = async () => {
    try {
      setLoading(true)
      const response = await stellarRouteAPI.getCurrentSpaceWeather(mapCenter[0], mapCenter[1])
      setSpaceWeather(response.data)
      
      let boundsToUse = mapBounds;
      if (!boundsToUse) {
          const lat = mapCenter[0];
          const lon = mapCenter[1];
          boundsToUse = {
              _northEast: { lat: lat + 0.1, lng: lon + 0.1 },
              _southWest: { lat: lat - 0.1, lng: lon - 0.1 }
          };
      }
      fetchHeatmap(boundsToUse);
      
    } catch (error) {
      console.error('Error fetching space weather:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHeatmap = async (bounds) => {
    try {
      if (!bounds) return;

      let north, south, east, west;

      if (bounds._northEast && bounds._southWest) {
          north = bounds._northEast.lat;
          south = bounds._southWest.lat;
          east = bounds._northEast.lng;
          west = bounds._southWest.lng;
      } 
      else if (typeof bounds.getNorth === 'function') {
          north = bounds.getNorth();
          south = bounds.getSouth();
          east = bounds.getEast();
          west = bounds.getWest();
      }

      if (isNaN(north)) return;

      const bboxList = [
          parseFloat(west), 
          parseFloat(south),
          parseFloat(east), 
          parseFloat(north)
      ];
      
      const response = await stellarRouteAPI.getHeatmap(bboxList);
      setHeatmapData(response.data);

    } catch (error) {
      console.error('Heatmap Error:', error);
    }
  }

  const calculateRoute = async (start, end, mode = 'normal') => {
    try {
      setLoading(true)
      const response = await stellarRouteAPI.calculateRoute(start, end, mode)
      const data = response.data

      setRoutes(data.alternatives || {})
      setCurrentRouteMode(mode)

      let routePath = data.route?.path || [start, end]
      
      if (mode === 'normal' && simulationMode && data.alternatives?.drifted?.path) {
          routePath = data.alternatives.drifted.path;
      } else if (data.alternatives?.normal?.path) {
          routePath = data.alternatives.normal.path;
      }

      if (!vehicleMoving) {
        vehicleAnimatorRef.current = new VehicleAnimator(routePath)
        setVehiclePosition(routePath[0])
        lastPositionRef.current = routePath[0]
      }
      
      if (start && end) {
          if (data.alternatives?.safe?.path) {
              setImuPath(data.alternatives.safe.path);
          } else {
              calculateIMUPath(start, end);
          }
      }
      
    } catch (error) {
      console.error('Error calculating route:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const calculateIMUPath = async (start, end) => {
    try {
      const response = await stellarRouteAPI.calculateRoute(start, end, 'safe')
      const data = response.data
      if (data.alternatives?.safe?.path) {
        setImuPath(data.alternatives.safe.path)
      }
    } catch (error) {
      console.error('Error calculating IMU path:', error)
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

  // --- MODE SWITCHERS ---
  const toggleSystemMode = (targetMode) => {
    const isSafeMode = targetMode === 'safe';
    setCurrentRouteMode(targetMode);
    
    const shouldGPSBeActive = !isSafeMode; 
    setGPSActive(shouldGPSBeActive);
    
    const currentPos = vehiclePosition || startPoint;
    lastPositionRef.current = currentPos;

    if (!shouldGPSBeActive) {
      const targetPath = imuPath.length > 0 ? imuPath : (routes.safe?.path || routes.normal?.path || []);
      if (targetPath.length > 0) {
          const closestIndex = findClosestPathIndex(currentPos, targetPath);
          const remainingPath = targetPath.slice(closestIndex);
          imuNavigatorRef.current = new VehicleAnimator(remainingPath);
      }
      setUseIMUNavigation(true);
    } else {
      let targetPath = routes.normal?.path || [];
      if (simulationMode && routes.drifted?.path && routes.drifted.path.length > 0) {
          targetPath = routes.drifted.path;
      }
      if (targetPath.length > 0) {
          const closestIndex = findClosestPathIndex(currentPos, targetPath);
          const remainingPath = targetPath.slice(closestIndex);
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

  const toggleRealTimeMode = () => {
      const newState = !realTimeMode;
      setRealTimeMode(newState);
      if (newState) {
          setVehicleMoving(false); 
          setGPSActive(false);     
          setUseIMUNavigation(true); 
          setDriftPath([]);        
          setLastSensorTime(0);    
          alert("Real-Time Mode Active! Move your phone to navigate.");
      } else {
          setGPSActive(true);
          setUseIMUNavigation(false);
      }
  };

  // --- ANIMATION LOOP ---
  useEffect(() => {
    let animationId
    const animate = () => {
      if (vehicleMoving && !realTimeMode) {
        let displayPosition;
        if (gpsActive) {
             if (vehicleAnimatorRef.current) displayPosition = vehicleAnimatorRef.current.update();
        } else {
             if (imuNavigatorRef.current) displayPosition = imuNavigatorRef.current.update();
        }
        
        if (displayPosition) {
            setVehiclePosition(displayPosition);
            const currentAnimator = gpsActive ? vehicleAnimatorRef.current : imuNavigatorRef.current;
            if (currentAnimator && !currentAnimator.isMoving) setVehicleMoving(false);
        }
        animationId = requestAnimationFrame(animate);
      }
    }

    if (vehicleMoving && !realTimeMode) {
      if (gpsActive) vehicleAnimatorRef.current?.start();
      else imuNavigatorRef.current?.start();
      animationId = requestAnimationFrame(animate)
    } else {
      vehicleAnimatorRef.current?.pause()
      imuNavigatorRef.current?.pause()
      if (animationId) cancelAnimationFrame(animationId)
    }
    return () => { if (animationId) cancelAnimationFrame(animationId) }
  }, [vehicleMoving, gpsActive, useIMUNavigation, realTimeMode])

  const resetSimulation = () => {
    setVehicleMoving(false)
    setRealTimeMode(false) 
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
                  <button onClick={handleLogout} className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors">
                    Logout
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowLoginModal(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  Login
                </button>
              )}

              <button onClick={resetSimulation} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors">
                Reset Demo
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* POINT SELECTION MODAL */}
      {activePointType === 'selecting' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] animate-fade-in">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Set Point on Map</h3>
            <p className="text-gray-600 mb-6">Choose which point you want to set, then click on the map.</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button onClick={() => setActivePointType('start')} className="p-4 border-2 border-blue-100 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all group">
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-blue-500 rounded-full text-white shadow-md group-hover:scale-110"><MapPin className="w-6 h-6" /></div>
                  <span className="font-semibold text-blue-700">Set Start</span>
                </div>
              </button>
              <button onClick={() => setActivePointType('end')} className="p-4 border-2 border-green-100 bg-green-50 rounded-xl hover:bg-green-100 transition-all group">
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-green-500 rounded-full text-white shadow-md group-hover:scale-110"><Target className="w-6 h-6" /></div>
                  <span className="font-semibold text-green-700">Set End</span>
                </div>
              </button>
            </div>
            <button onClick={() => setActivePointType(null)} className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}
      
      {/* SELECTION INDICATOR */}
      {(activePointType === 'start' || activePointType === 'end') && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[2000] bg-gray-900/90 text-white px-6 py-3 rounded-full shadow-lg backdrop-blur-sm animate-bounce-subtle flex items-center gap-3">
          {activePointType === 'start' ? <MapPin className="w-5 h-5 text-blue-400" /> : <Target className="w-5 h-5 text-green-400" />}
          <span className="font-medium">Click on map to set {activePointType === 'start' ? 'Start Point' : 'End Point'}</span>
          <button onClick={() => setActivePointType(null)} className="ml-2 p-1 hover:bg-white/20 rounded-full">✕</button>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            
            {/* 1. LIVE SENSOR TOGGLE */}
            <div className="glass-card p-4 rounded-xl border-2 border-purple-500 shadow-sm bg-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Wifi className={`w-5 h-5 ${realTimeMode ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-800 leading-tight">Live Phone Sensor</span>
                            <span className="text-[10px] text-gray-500">Firebase: {realTimeMode ? 'Listening' : 'Idle'}</span>
                        </div>
                    </div>
                    <button onClick={toggleRealTimeMode} className={`px-4 py-2 rounded-lg font-bold text-xs tracking-wide transition-all ${ realTimeMode ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-md' : 'bg-gray-200 text-gray-600 hover:bg-gray-300' }`}>
                        {realTimeMode ? 'DISABLE' : 'ENABLE'}
                    </button>
                </div>
            </div>

            {/* 2. SOLAR STORM 3D GLOBE (REPLACES 2D PANEL) */}
           <div className="h-[500px] rounded-xl overflow-hidden shadow-lg border border-gray-200 bg-black relative">
    <SolarStormGlobe kpIndex={spaceWeather?.kp_index || 2} />
</div>

            {/* 3. SIMULATION CONTROLS */}
            <SpaceWeatherPanel
              spaceWeather={spaceWeather}
              onRefresh={fetchSpaceWeather}
              onSimulate={simulateStorm}
              simulationMode={simulationMode}
              loading={loading}
              hideChart={true} // Optional: If you want to hide the old chart since you have the globe now
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
              {activePointType === 'selecting' && <div className="absolute inset-0 bg-black/10 z-10 pointer-events-none" />}
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
                  {realTimeMode && <div className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">Live Sensors</div>}
                </div>
                <div className="text-sm text-gray-600">
                  {vehiclePosition && <span>Vehicle: {vehiclePosition[0].toFixed(6)}, {vehiclePosition[1].toFixed(6)}</span>}
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
            <div className="text-gray-600"><p className="font-medium">StellarRoute - Hackathon Project</p></div>
            <div className="flex items-center gap-4">
              <button onClick={() => window.open('http://localhost:8000/docs', '_blank')} className="text-sm text-primary hover:text-primary/80">API Documentation</button>
            </div>
          </div>
        </div>
      </footer>

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

      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} onSuccess={handleLoginSuccess} />}
    </div>
  )
}

export default App