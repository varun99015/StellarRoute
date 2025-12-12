import React, { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Navigation2, Satellite, MapPin, Target } from 'lucide-react'
import MapComponent from './components/MapComponent'
import SpaceWeatherPanel from './components/SpaceWeatherPanel'
import ControlPanel from './components/ControlPanel'
import RouteComparison from './components/RouteComparison'
import { stellarRouteAPI } from './services/api'
import { GPSSimulator, VehicleAnimator, IMUNavigator } from './utils/simulation'
import { DEMO_COORDINATES } from './utils/constants'

function App() {
  // State
  const [spaceWeather, setSpaceWeather] = useState(null)
  const [heatmapData, setHeatmapData] = useState(null)
  const [routes, setRoutes] = useState({})
  const [currentRouteMode, setCurrentRouteMode] = useState('normal')
  const [loading, setLoading] = useState(false)
  const [simulationMode, setSimulationMode] = useState(false)
  const [activePointType, setActivePointType] = useState(null)
  const [imuPath, setImuPath] = useState([])
  const [driftPath, setDriftPath] = useState([])

  // Map State
  const [mapCenter] = useState(DEMO_COORDINATES.SAN_FRANCISCO)
  const [startPoint, setStartPoint] = useState(DEMO_COORDINATES.SAN_FRANCISCO)
  const [endPoint, setEndPoint] = useState(DEMO_COORDINATES.OAKLAND)
  const [mapBounds, setMapBounds] = useState(null)
  
  // Simulation State
  const [gpsActive, setGPSActive] = useState(true)
  const [vehicleMoving, setVehicleMoving] = useState(false)
  const [vehiclePosition, setVehiclePosition] = useState(null)
  const [useIMUNavigation, setUseIMUNavigation] = useState(false)
  
  // Refs
  const gpsSimulatorRef = useRef(null)
  const vehicleAnimatorRef = useRef(null)
  const imuNavigatorRef = useRef(null)
  const animationFrameRef = useRef(null)
  const lastPositionRef = useRef(null) 
  
  // Initialize
  useEffect(() => {
    fetchSpaceWeather()
    gpsSimulatorRef.current = new GPSSimulator(startPoint)
    imuNavigatorRef.current = new IMUNavigator(startPoint)
    
    setTimeout(() => {
      calculateRoute(startPoint, endPoint, 'normal')
    }, 1000)
    
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])
  
  // ... (Keep fetchSpaceWeather, fetchHeatmap as is) ...
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
      
      const routePath = data.route?.path || [start, end]
      
      // If we are NOT currently moving, reset vehicle to start
      if (!vehicleMoving) {
        vehicleAnimatorRef.current = new VehicleAnimator(routePath)
        setVehiclePosition(routePath[0])
        lastPositionRef.current = routePath[0]
      } else {
        // If we ARE moving, we need to handle dynamic rerouting (advanced)
        // For now, let's just let the current animation finish or reset if needed
      }
      
      if (start && end) calculateIMUPath(start, end)
      
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

  // ... (Keep simulateStorm, handleMapClick as is) ...
  const simulateStorm = async (scenario) => {
    try {
      setLoading(true)
      const response = await stellarRouteAPI.simulateStorm(scenario, mapCenter[0], mapCenter[1])
      setSpaceWeather(response.data)
      setSimulationMode(true)
      if (startPoint && endPoint) calculateRoute(startPoint, endPoint, currentRouteMode)
    } catch (error) { console.error(error); setLoading(false) }
  }

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

  const showNotification = (message) => {
    // ... (same as before) ...
  }
  
  const handleBoundsChange = (bounds) => {
    setMapBounds(bounds)
    fetchHeatmap(bounds)
  }

  // Helper to find closest point index on a path
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

  // Toggle GPS failure
  const toggleGPSFailure = () => {
    const newGPSState = !gpsActive
    setGPSActive(newGPSState)
    
    // Get current vehicle position
    const currentPos = vehiclePosition || startPoint
    lastPositionRef.current = currentPos 
    
    if (newGPSState === false) {
      // --- ENTERING FAILURE MODE ---
      
      const riskLevel = spaceWeather?.risk_level || 'medium'
      const driftSeverity = (spaceWeather?.kp_index || 0) < 4 ? 'low' : (spaceWeather?.kp_index || 0) < 7 ? 'medium' : 'high'
      
      // 1. Initialize GPS Simulator (for random drift)
      gpsSimulatorRef.current = new GPSSimulator(currentPos)
      gpsSimulatorRef.current.simulateGPSFailure(riskLevel, driftSeverity)
      
      // 2. Initialize IMU Navigator (for dead reckoning along path)
      // FIX: Slice the path so we start from where we ARE, not the beginning
      const activePath = imuPath.length > 0 ? imuPath : (routes[currentRouteMode]?.path || [])
      const closestIndex = findClosestPathIndex(currentPos, activePath)
      const remainingPath = activePath.slice(closestIndex)
      
      if (remainingPath.length > 0) {
        imuNavigatorRef.current = new IMUNavigator(currentPos, remainingPath)
      }

      setUseIMUNavigation(true) 
      
    } else {
      // --- RESTORING GPS ---
      
      if (gpsSimulatorRef.current) gpsSimulatorRef.current.restoreGPS()
      
      // Snap back to the "True" position being tracked by the main animator
      if (vehicleAnimatorRef.current) {
        const truePos = vehicleAnimatorRef.current.update() // Get true pos from animator
        setVehiclePosition(truePos)
        lastPositionRef.current = truePos
      }
      
      setUseIMUNavigation(false)
      setDriftPath([])
    }
  }

  // Animation loop
  useEffect(() => {
    let animationId
    const animate = () => {
      if (vehicleAnimatorRef.current && vehicleMoving) {
        // Always track TRUE position in background
        const actualPosition = vehicleAnimatorRef.current.update()
        
        let displayPosition = actualPosition
        
        if (!gpsActive) {
          if (useIMUNavigation && imuNavigatorRef.current) {
             // IMU Mode: Follow the "Dead Reckoning" path (Sliced path)
             displayPosition = imuNavigatorRef.current.update() 
          } else if (gpsSimulatorRef.current) {
             // Drift Mode
             displayPosition = gpsSimulatorRef.current.updatePosition()
             setDriftPath(prev => [...prev, displayPosition])
          }
        }
        
        setVehiclePosition(displayPosition)
        
        if (vehicleAnimatorRef.current.isMoving) {
          animationId = requestAnimationFrame(animate)
        } else {
          setVehicleMoving(false)
          if (!gpsActive) showNotification('Journey complete (IMU Mode)')
        }
      }
    }

    if (vehicleMoving) {
      vehicleAnimatorRef.current?.start()
      animationId = requestAnimationFrame(animate)
    } else {
      vehicleAnimatorRef.current?.pause()
      if (animationId) cancelAnimationFrame(animationId)
    }

    return () => { if (animationId) cancelAnimationFrame(animationId) }
  }, [vehicleMoving, gpsActive, useIMUNavigation])

  // ... (Rest of component: resetSimulation, useDemoRoute, render) ...
  // (Paste the rest of the existing functions here if copying full file, 
  //  otherwise just replace the toggleGPSFailure and calculateRoute logic)

  const resetSimulation = () => {
    setVehicleMoving(false)
    setGPSActive(true)
    setUseIMUNavigation(false)
    setDriftPath([])
    setVehiclePosition(startPoint)
    lastPositionRef.current = startPoint
    
    if (gpsSimulatorRef.current) gpsSimulatorRef.current.reset()
    
    if (vehicleAnimatorRef.current) {
      vehicleAnimatorRef.current.reset()
      const route = routes[currentRouteMode]?.path || [startPoint, endPoint]
      vehicleAnimatorRef.current = new VehicleAnimator(route)
    }
  }
  
  const useDemoRoute = (routeName) => {
      // ... same as before
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
    // ... (Keep existing JSX exactly as is) ...
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b">
         {/* ... Header content ... */}
         <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Navigation2 className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-gray-900">StellarRoute</h1>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={resetSimulation} className="px-4 py-2 bg-gray-100 rounded-lg">Reset</button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <SpaceWeatherPanel spaceWeather={spaceWeather} onRefresh={fetchSpaceWeather} onSimulate={simulateStorm} simulationMode={simulationMode} loading={loading} />
            <ControlPanel routeMode={currentRouteMode} onRouteModeChange={(mode) => { setCurrentRouteMode(mode); if(startPoint && endPoint) calculateRoute(startPoint, endPoint, mode) }} gpsActive={gpsActive} onGPSFailureToggle={toggleGPSFailure} vehicleMoving={vehicleMoving} onVehicleMoveToggle={() => setVehicleMoving(!vehicleMoving)} onReset={resetSimulation} onSetPoints={() => setActivePointType('selecting')} onClearPoints={() => { setStartPoint(null); setEndPoint(null); setRoutes({}); setVehiclePosition(null); setDriftPath([]) }} startPoint={startPoint} endPoint={endPoint} onUseDemoRoute={useDemoRoute} />
          </div>
          <div className="lg:col-span-2">
            <div className="h-[600px] rounded-xl overflow-hidden shadow-xl">
              <MapComponent center={mapCenter} zoom={12} heatmapData={heatmapData} routes={routes} vehiclePosition={vehiclePosition} startPoint={startPoint} endPoint={endPoint} gpsActive={gpsActive} imuPath={imuPath} driftPath={driftPath} useIMUNavigation={useIMUNavigation} onMapClick={handleMapClick} onBoundsChange={handleBoundsChange} />
            </div>
            {/* ... Status and Comparison ... */}
            <div className="mt-6"><RouteComparison routes={routes} currentMode={currentRouteMode} onSelectRoute={(mode) => { setCurrentRouteMode(mode); if(startPoint && endPoint) calculateRoute(startPoint, endPoint, mode) }} /></div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App