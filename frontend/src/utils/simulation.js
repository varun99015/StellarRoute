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
  
  updatePosition(routeIndex, totalPoints, riskLevel) {
    if (this.gpsActive) {
      return this.position
    }
    
    // Simulate drift away from route
    const drift = this.driftMagnitude * (Math.random() - 0.5)
    const [lat, lon] = this.position
    const newLat = lat + drift
    const newLon = lon + drift
    
    this.position = [newLat, newLon]
    this.driftPath.push(this.position)
    
    return this.position
  }
  
  restoreGPS() {
    this.gpsActive = true
    this.position = this.lastKnownPosition
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
  constructor(route, speed = 50) { // pixels per second
    this.route = route
    this.speed = speed
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
    if (this.route.length < 2) return this.route[0] || [0, 0]
    
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
    if (!this.isMoving || this.route.length < 2) return
    
    const now = Date.now()
    const delta = (now - this.lastUpdate) / 1000 // seconds
    this.lastUpdate = now
    
    // Calculate distance between current segment points
    if (this.currentIndex < this.route.length - 1) {
      const start = this.route[this.currentIndex]
      const end = this.route[this.currentIndex + 1]
      
      // Approximate segment length (simplified)
      const segmentLength = Math.sqrt(
        Math.pow(end[0] - start[0], 2) + 
        Math.pow(end[1] - start[1], 2)
      )
      
      const progressIncrement = (this.speed * delta) / segmentLength
      this.progress += progressIncrement
      
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