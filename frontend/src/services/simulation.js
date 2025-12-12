// GPS Failure Simulation Utilities
export class GPSSimulator {
  constructor(startPosition) {
    this.position = startPosition
    this.gpsActive = true
    this.driftPath = []
    this.lastKnownPosition = startPosition
    this.driftMagnitude = 0
  }
  
  simulateGPSFailure(riskLevel) {
    this.gpsActive = false
    this.driftMagnitude = this.getDriftFromRisk(riskLevel)
    this.driftPath = [this.position]
    return this.position
  }
  
  getDriftFromRisk(riskLevel) {
    switch(riskLevel) {
      case 'low': return 0.0001 // ~11m
      case 'medium': return 0.0005 // ~55m
      case 'high': return 0.001 // ~111m
      default: return 0.0002
    }
  }
  
  // FIX: Added 'actualPosition' argument so the red car moves along the route
  updatePosition(actualPosition) {
    if (this.gpsActive) {
      this.position = actualPosition
      return this.position
    }
    
    // Simulate drift relative to the actual position
    // (Simulating noisy signal or IMU drift)
    const drift = this.driftMagnitude * (Math.random() - 0.5) * 5
    
    // Apply drift to the REAL position so the car moves but jitters
    const newLat = actualPosition[0] + drift
    const newLon = actualPosition[1] + drift
    
    this.position = [newLat, newLon]
    this.driftPath.push(this.position)
    
    return this.position
  }
  
  restoreGPS() {
    this.gpsActive = true
    // When restored, snap back to the last calculated real position (handled in App.jsx loop)
    return this.position
  }
  
  reset() {
    this.gpsActive = true
    this.driftPath = []
    this.driftMagnitude = 0
  }
}

// Vehicle Animation
export class VehicleAnimator {
  constructor(route, speedKmH = 50) { 
    this.route = route
    
    // FIX: Convert km/h to degrees/second for map coordinates
    // 50 km/h = ~13.88 m/s
    // 1 degree lat is approx 111,000 meters
    const speedMetersPerSec = (speedKmH * 1000) / 3600
    this.speed = speedMetersPerSec / 111000 

    this.currentIndex = 0
    this.progress = 0
    this.isMoving = false
    this.lastUpdate = Date.now()
  }
  
  start() {
    this.isMoving = true
    this.lastUpdate = Date.now()
  }
  
  pause() {
    this.isMoving = false
  }
  
  reset() {
    this.currentIndex = 0
    this.progress = 0
    this.isMoving = false
  }
  
  getCurrentPosition() {
    if (!this.route || this.route.length < 1) return [0,0]
    if (this.route.length === 1) return this.route[0]
    
    if (this.currentIndex >= this.route.length - 1) {
      return this.route[this.route.length - 1]
    }
    
    const start = this.route[this.currentIndex]
    const end = this.route[this.currentIndex + 1]
    
    const lat = start[0] + (end[0] - start[0]) * this.progress
    const lon = start[1] + (end[1] - start[1]) * this.progress
    
    return [lat, lon]
  }
  
  update() {
    if (!this.isMoving || !this.route || this.route.length < 2) return this.getCurrentPosition()
    
    const now = Date.now()
    const delta = (now - this.lastUpdate) / 1000 // seconds
    this.lastUpdate = now
    
    if (this.currentIndex < this.route.length - 1) {
      const start = this.route[this.currentIndex]
      const end = this.route[this.currentIndex + 1]
      
      const segmentLength = Math.sqrt(
        Math.pow(end[0] - start[0], 2) + 
        Math.pow(end[1] - start[1], 2)
      )
      
      // FIX: Protection against zero-length segments
      if (segmentLength > 0.000001) {
        const progressIncrement = (this.speed * delta) / segmentLength
        this.progress += progressIncrement
      } else {
        this.progress = 1
      }
      
      if (this.progress >= 1) {
        this.currentIndex++
        this.progress = 0
        
        if (this.currentIndex >= this.route.length - 1) {
          this.isMoving = false // Reached destination
        }
      }
    }
    
    return this.getCurrentPosition()
  }
}