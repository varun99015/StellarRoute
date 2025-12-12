import React from 'react'
import { 
  Navigation, 
  Shield, 
  Satellite, 
  WifiOff, 
  Play, 
  Pause, 
  RotateCcw,
  MapPin,
  Target
} from 'lucide-react'
import { DEMO_COORDINATES } from '../utils/constants'

const ControlPanel = ({
  routeMode,
  onRouteModeChange,
  gpsActive,
  onGPSFailureToggle,
  vehicleMoving,
  onVehicleMoveToggle,
  onReset,
  onSetStartPoint,
  onSetEndPoint,
  startPoint,
  endPoint,
  onClearPoints,
  onUseDemoRoute
}) => {
  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-6">
        <Navigation className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-gray-800">Navigation Controls</h2>
      </div>
      
      {/* Route Mode Selection */}
      <div className="mb-6">
        <div className="text-sm font-medium text-gray-700 mb-3">Route Optimization</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onRouteModeChange('normal')}
            className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${routeMode === 'normal' ? 'border-primary bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <Navigation className={`w-6 h-6 mb-2 ${routeMode === 'normal' ? 'text-primary' : 'text-gray-500'}`} />
            <span className={`font-medium ${routeMode === 'normal' ? 'text-primary' : 'text-gray-700'}`}>
              Normal
            </span>
            <span className="text-xs text-gray-500 mt-1">Fastest route</span>
          </button>
          
          <button
            onClick={() => onRouteModeChange('safe')}
            className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${routeMode === 'safe' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <Shield className={`w-6 h-6 mb-2 ${routeMode === 'safe' ? 'text-green-600' : 'text-gray-500'}`} />
            <span className={`font-medium ${routeMode === 'safe' ? 'text-green-600' : 'text-gray-700'}`}>
              Storm-Safe
            </span>
            <span className="text-xs text-gray-500 mt-1">Avoids high risk</span>
          </button>
        </div>
      </div>
      
      {/* GPS Controls */}
      <div className="mb-6">
        <div className="text-sm font-medium text-gray-700 mb-3">GPS Simulation</div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Satellite className={`w-5 h-5 ${gpsActive ? 'text-green-600' : 'text-gray-400'}`} />
              <span className={`font-medium ${gpsActive ? 'text-green-700' : 'text-gray-600'}`}>
                {gpsActive ? 'GPS Active' : 'GPS Failed'}
              </span>
            </div>
            <div className={`px-2 py-1 text-xs rounded-full ${gpsActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {gpsActive ? 'Normal' : 'IMU Only'}
            </div>
          </div>
          
          <button
            onClick={onGPSFailureToggle}
            className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${gpsActive ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
          >
            <WifiOff className="w-4 h-4" />
            {gpsActive ? 'Simulate GPS Failure' : 'Restore GPS Signal'}
          </button>
          
          <div className="text-xs text-gray-500 mt-3">
            {gpsActive 
              ? 'GPS is providing accurate position data'
              : 'Simulating GPS failure - using IMU dead reckoning for navigation'
            }
          </div>
        </div>
      </div>
      
      {/* Vehicle Controls */}
      <div className="mb-6">
        <div className="text-sm font-medium text-gray-700 mb-3">Vehicle Controls</div>
        <div className="flex gap-2">
          <button
            onClick={onVehicleMoveToggle}
            className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${vehicleMoving ? 'bg-yellow-100 text-yellow-700' : 'bg-primary text-white'}`}
          >
            {vehicleMoving ? (
              <>
                <Pause className="w-4 h-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Journey
              </>
            )}
          </button>
          
          <button
            onClick={onReset}
            className="p-3 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            title="Reset simulation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Route Points */}
      <div className="mb-6">
        <div className="text-sm font-medium text-gray-700 mb-3">Route Points</div>
        <div className="space-y-3">
<div className="flex gap-2 pt-2">
  <button
    onClick={() => {
      onClearPoints();
    }}
    className="flex-1 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
  >
    Clear Points
  </button>
</div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm">Start Point</span>
            </div>
            <div className="text-xs text-gray-500">
              {startPoint 
                ? `${startPoint[0].toFixed(4)}, ${startPoint[1].toFixed(4)}`
                : 'Not set'
              }
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm">End Point</span>
            </div>
            <div className="text-xs text-gray-500">
              {endPoint 
                ? `${endPoint[0].toFixed(4)}, ${endPoint[1].toFixed(4)}`
                : 'Not set'
              }
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onSetStartPoint && onSetStartPoint()}
              className="flex-1 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
            >
              <MapPin className="w-3 h-3" />
              Set Start
            </button>
            <button
              onClick={() => onSetEndPoint && onSetEndPoint()}
              className="flex-1 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
            >
              <Target className="w-3 h-3" />
              Set End
            </button>
          </div>
        </div>
      </div>
      
      {/* Demo Routes */}
      <div>
        <div className="text-sm font-medium text-gray-700 mb-3">Quick Demo Routes</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onUseDemoRoute('SF_OAKLAND')}
            className="py-2 px-3 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            SF → Oakland
          </button>
          <button
            onClick={() => onUseDemoRoute('SF_BERKELEY')}
            className="py-2 px-3 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            SF → Berkeley
          </button>
          <button
            onClick={() => onUseDemoRoute('SF_SAN_JOSE')}
            className="py-2 px-3 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors col-span-2"
          >
            SF → San Jose
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Click on map to set custom points
        </div>
      </div>
    </div>
  )
}

export default ControlPanel