import React from 'react'
import { Navigation, Shield, Clock, MapPin, AlertTriangle, TrendingUp } from 'lucide-react'
import { RISK_LEVELS } from '../utils/constants'

const RouteComparison = ({ routes, currentMode, onSelectRoute }) => {
  if (!routes || (!routes.normal && !routes.safe)) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <div className="flex items-center justify-center h-40">
          <div className="text-gray-500">Calculate a route to see comparison</div>
        </div>
      </div>
    )
  }
  
  const normalRoute = routes.normal
  const safeRoute = routes.safe
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`
    }
    return `${(meters / 1000).toFixed(1)}km`
  }
  
  const calculateDifference = (normal, safe, type) => {
    if (normal === undefined || safe === undefined) return 'N/A'
    
    // FIX: Division by zero protection
    if (normal === 0) {
        if (type === 'risk') return safe === 0 ? '0%' : '+100%'
        // For distance/time, 0 is unlikely but safe to handle
        if (safe === 0) return '0%'
        return '+100%'
    }

    if (type === 'distance') {
      const diff = safe - normal
      const percent = (diff / normal) * 100
      return `${percent > 0 ? '+' : ''}${percent.toFixed(0)}%`
    }
    
    if (type === 'time') {
      const diff = safe - normal
      const percent = (diff / normal) * 100
      return `${percent > 0 ? '+' : ''}${percent.toFixed(0)}%`
    }
    
    if (type === 'risk') {
      const diff = normal - safe
      const percent = (diff / normal) * 100
      return `${percent > 0 ? '-' : '+'}${percent.toFixed(0)}%`
    }
    
    return 'N/A'
  }
  
  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-gray-800">Route Comparison</h2>
      </div>
      
      {/* Route Selection Tabs */}
      <div className="flex mb-6 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => onSelectRoute('normal')}
          className={`flex-1 py-2 rounded-md text-center font-medium transition-all ${currentMode === 'normal' ? 'bg-white shadow-sm text-primary' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <Navigation className="w-4 h-4" />
            Normal Route
          </div>
        </button>
        <button
          onClick={() => onSelectRoute('safe')}
          className={`flex-1 py-2 rounded-md text-center font-medium transition-all ${currentMode === 'safe' ? 'bg-white shadow-sm text-green-600' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" />
            Safe Route
          </div>
        </button>
      </div>
      
      {/* Comparison Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Metric</th>
              <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Normal</th>
              <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Safe</th>
              <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Difference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {/* Distance */}
            <tr className="hover:bg-gray-50">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">Distance</span>
                </div>
              </td>
              <td className="py-3 px-4">
                <span className="font-medium">{formatDistance(normalRoute?.distance_m || 0)}</span>
              </td>
              <td className="py-3 px-4">
                <span className="font-medium text-green-600">{formatDistance(safeRoute?.distance_m || 0)}</span>
              </td>
              <td className="py-3 px-4">
                <span className={`text-sm ${calculateDifference(normalRoute?.distance_m, safeRoute?.distance_m, 'distance').includes('+') ? 'text-red-600' : 'text-green-600'}`}>
                  {calculateDifference(normalRoute?.distance_m, safeRoute?.distance_m, 'distance')}
                </span>
              </td>
            </tr>
            
            {/* Time */}
            <tr className="hover:bg-gray-50">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">Estimated Time</span>
                </div>
              </td>
              <td className="py-3 px-4">
                <span className="font-medium">{formatTime(normalRoute?.estimated_time_s || 0)}</span>
              </td>
              <td className="py-3 px-4">
                <span className="font-medium text-green-600">{formatTime(safeRoute?.estimated_time_s || 0)}</span>
              </td>
              <td className="py-3 px-4">
                <span className={`text-sm ${calculateDifference(normalRoute?.estimated_time_s, safeRoute?.estimated_time_s, 'time').includes('+') ? 'text-red-600' : 'text-green-600'}`}>
                  {calculateDifference(normalRoute?.estimated_time_s, safeRoute?.estimated_time_s, 'time')}
                </span>
              </td>
            </tr>
            
            {/* Risk Score */}
            <tr className="hover:bg-gray-50">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">Risk Score</span>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${RISK_LEVELS[normalRoute?.max_risk_zone]?.bg || 'bg-gray-300'}`}></div>
                  <span className="font-medium">{normalRoute?.total_risk_score?.toFixed(0) || 0}/100</span>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${RISK_LEVELS[safeRoute?.max_risk_zone]?.bg || 'bg-gray-300'}`}></div>
                  <span className="font-medium text-green-600">{safeRoute?.total_risk_score?.toFixed(0) || 0}/100</span>
                </div>
              </td>
              <td className="py-3 px-4">
                <span className={`text-sm ${calculateDifference(normalRoute?.total_risk_score, safeRoute?.total_risk_score, 'risk').includes('-') ? 'text-green-600' : 'text-red-600'}`}>
                  {calculateDifference(normalRoute?.total_risk_score, safeRoute?.total_risk_score, 'risk')}
                </span>
              </td>
            </tr>
            
            {/* Max Risk Zone */}
            <tr className="hover:bg-gray-50">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">Max Risk Zone</span>
                </div>
              </td>
              <td className="py-3 px-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${RISK_LEVELS[normalRoute?.max_risk_zone]?.text} ${RISK_LEVELS[normalRoute?.max_risk_zone]?.bg}/20`}>
                  {normalRoute?.max_risk_zone?.toUpperCase() || 'N/A'}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${RISK_LEVELS[safeRoute?.max_risk_zone]?.text} ${RISK_LEVELS[safeRoute?.max_risk_zone]?.bg}/20`}>
                  {safeRoute?.max_risk_zone?.toUpperCase() || 'N/A'}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className={`text-sm ${
                  normalRoute?.max_risk_zone === 'high' && safeRoute?.max_risk_zone === 'low' ? 'text-green-600' :
                  normalRoute?.max_risk_zone === safeRoute?.max_risk_zone ? 'text-gray-600' : 'text-yellow-600'
                }`}>
                  {normalRoute?.max_risk_zone === safeRoute?.max_risk_zone ? 'Same' : 'Improved'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Summary */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div className="text-sm font-medium text-blue-800 mb-2">Summary</div>
        <div className="text-sm text-blue-700">
          {currentMode === 'normal' ? (
            <>Normal route is <span className="font-semibold">{formatDistance(normalRoute?.distance_m || 0)}</span> with <span className="font-semibold">{normalRoute?.total_risk_score?.toFixed(0) || 0}/100</span> risk score</>
          ) : (
            <>Safe route adds <span className="font-semibold">{calculateDifference(normalRoute?.distance_m, safeRoute?.distance_m, 'distance')}</span> distance but reduces risk by <span className="font-semibold">{calculateDifference(normalRoute?.total_risk_score, safeRoute?.total_risk_score, 'risk')}</span></>
          )}
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => onSelectRoute('normal')}
          className={`flex-1 py-3 rounded-lg font-medium ${currentMode === 'normal' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          Use Normal Route
        </button>
        <button
          onClick={() => onSelectRoute('safe')}
          className={`flex-1 py-3 rounded-lg font-medium ${currentMode === 'safe' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          Use Safe Route
        </button>
      </div>
    </div>
  )
}

export default RouteComparison