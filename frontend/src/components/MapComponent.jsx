import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Polygon, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { calculateBoundingBox } from '../services/api'
import { RISK_LEVELS } from '../utils/constants'

// Custom vehicle icon
const createVehicleIcon = (gpsActive) => {
  return L.divIcon({
    html: `
      <div class="relative">
        <div class="w-8 h-8 ${gpsActive ? 'bg-blue-600' : 'bg-red-600'} rounded-full flex items-center justify-center shadow-lg border-2 border-white">
          <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
          </svg>
        </div>
        ${!gpsActive && `
          <div class="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-pulse border border-white"></div>
          <div class="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-ping border border-white"></div>
        `}
      </div>
    `,
    className: 'vehicle-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  })
}

// Custom start/end icons
const createPointIcon = (color, type) => {
  return L.divIcon({
    html: `
      <div class="relative">
        <div class="w-10 h-10 ${color} rounded-full flex items-center justify-center shadow-lg border-4 border-white">
          <span class="text-white font-bold">${type === 'start' ? 'A' : 'B'}</span>
        </div>
      </div>
    `,
    className: 'point-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  })
}

// Map controller component
const MapController = ({ center, zoom, bounds }) => {
  const map = useMap()
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom)
    }
  }, [center, zoom, map])
  
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds)
    }
  }, [bounds, map])
  
  return null
}

const MapComponent = ({
  center = [37.7749, -122.4194],
  zoom = 13,
  heatmapData = null,
  routes = {},
  vehiclePosition = null,
  startPoint = null,
  endPoint = null,
  gpsActive = true,
  onMapClick = () => {},
  onBoundsChange = () => {}
}) => {
  const mapRef = useRef(null)
  const [mapBounds, setMapBounds] = useState(null)
  
  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current
      const updateBounds = () => {
        const bounds = map.getBounds()
        setMapBounds([
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth()
        ])
        onBoundsChange([
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth()
        ])
      }
      
      map.on('moveend', updateBounds)
      updateBounds()
      
      return () => {
        map.off('moveend', updateBounds)
      }
    }
  }, [onBoundsChange])
  
  // Render heatmap polygons
  const renderHeatmap = () => {
    if (!heatmapData?.features) return null
    
    return heatmapData.features.map((feature, index) => {
      const { geometry, properties } = feature
      const { risk_level, color, opacity } = properties
      
      return (
        <Polygon
          key={`heatmap-${index}`}
          positions={geometry.coordinates[0].map(coord => [coord[1], coord[0]])}
          pathOptions={{
            fillColor: color || RISK_LEVELS[risk_level]?.color || '#666',
            color: 'transparent',
            fillOpacity: opacity || 0.3,
            weight: 0
          }}
        >
          <Popup>
            <div className="p-2">
              <div className={`font-semibold ${RISK_LEVELS[risk_level]?.text}`}>
                {risk_level?.toUpperCase()} RISK ZONE
              </div>
              <div className="text-sm text-gray-600 mt-1">
                GPS Error: {properties.gps_error_min}m - {properties.gps_error_max}m
              </div>
              <div className="text-sm text-gray-600">
                Risk Score: {properties.risk_score}/100
              </div>
            </div>
          </Popup>
        </Polygon>
      )
    })
  }
  
  // Render routes
  const renderRoutes = () => {
    const elements = []
    
    if (routes.normal?.path) {
      elements.push(
        <Polyline
          key="normal-route"
          positions={routes.normal.path}
          pathOptions={{
            color: '#2563eb',
            weight: 4,
            opacity: 0.8,
            dashArray: null
          }}
        >
          <Popup>
            <div className="p-2">
              <div className="font-semibold text-blue-600">NORMAL ROUTE</div>
              <div className="text-sm text-gray-600 mt-1">
                Distance: {routes.normal.distance_m}m
              </div>
              <div className="text-sm text-gray-600">
                Risk: {routes.normal.total_risk_score}/100
              </div>
            </div>
          </Popup>
        </Polyline>
      )
    }
    
    if (routes.safe?.path) {
      elements.push(
        <Polyline
          key="safe-route"
          positions={routes.safe.path}
          pathOptions={{
            color: '#10b981',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10'
          }}
        >
          <Popup>
            <div className="p-2">
              <div className="font-semibold text-green-600">STORM-SAFE ROUTE</div>
              <div className="text-sm text-gray-600 mt-1">
                Distance: {routes.safe.distance_m}m
              </div>
              <div className="text-sm text-gray-600">
                Risk: {routes.safe.total_risk_score}/100
              </div>
            </div>
          </Popup>
        </Polyline>
      )
    }
    
    return elements
  }
  
  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-xl">
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        whenCreated={map => {
          mapRef.current = map
        }}
        onClick={(e) => {
          const { lat, lng } = e.latlng
          onMapClick([lat, lng])
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController center={center} zoom={zoom} />
        
        {/* Heatmap Overlay */}
        {renderHeatmap()}
        
        {/* Routes */}
        {renderRoutes()}
        
        {/* Start Point */}
        {startPoint && (
          <Marker 
            position={startPoint}
            icon={createPointIcon('bg-blue-500', 'start')}
            draggable={true}
          >
            <Popup>
              <div className="p-2">
                <div className="font-semibold text-blue-600">START POINT</div>
                <div className="text-sm text-gray-600">
                  {startPoint[0].toFixed(4)}, {startPoint[1].toFixed(4)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* End Point */}
        {endPoint && (
          <Marker 
            position={endPoint}
            icon={createPointIcon('bg-green-500', 'end')}
            draggable={true}
          >
            <Popup>
              <div className="p-2">
                <div className="font-semibold text-green-600">END POINT</div>
                <div className="text-sm text-gray-600">
                  {endPoint[0].toFixed(4)}, {endPoint[1].toFixed(4)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Vehicle Marker */}
        {vehiclePosition && (
          <Marker 
            position={vehiclePosition}
            icon={createVehicleIcon(gpsActive)}
          >
            <Popup>
              <div className="p-2">
                <div className="font-semibold">
                  {gpsActive ? '🚗 VEHICLE (GPS ACTIVE)' : '⚠️ VEHICLE (GPS FAILED)'}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Position: {vehiclePosition[0].toFixed(6)}, {vehiclePosition[1].toFixed(6)}
                </div>
                {!gpsActive && (
                  <div className="text-sm text-red-600 mt-1 font-medium">
                    Navigating via IMU dead reckoning
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
      
      {/* Map Controls Overlay */}
      <div className="absolute top-4 left-4 glass-card p-3 rounded-lg">
        <div className="text-sm font-medium text-gray-700">Map Controls</div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => mapRef.current?.setView(center, zoom)}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Reset View
          </button>
          <button
            onClick={() => mapRef.current?.zoomIn()}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Zoom In
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Zoom Out
          </button>
        </div>
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 glass-card p-3 rounded-lg">
        <div className="text-sm font-medium text-gray-700 mb-2">Map Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-xs">Start Point</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-xs">End Point</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-blue-600"></div>
            <span className="text-xs">Normal Route</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-green-600 border-dashed border"></div>
            <span className="text-xs">Safe Route</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-risk-low opacity-30"></div>
            <span className="text-xs">Low Risk Zone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-risk-medium opacity-30"></div>
            <span className="text-xs">Medium Risk Zone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-risk-high opacity-30"></div>
            <span className="text-xs">High Risk Zone</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MapComponent