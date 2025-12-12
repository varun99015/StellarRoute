// algorithms/sensor-fusion/DeadReckoning.js
class DeadReckoning {
    constructor(initialPosition = [0, 0, 0], initialHeading = 0) {
        // State variables
        this.position = initialPosition.slice();      // [x, y, z] in meters
        this.velocity = [0, 0, 0];                   // [vx, vy, vz] in m/s
        this.heading = initialHeading;               // radians, 0 = North, π/2 = East
        this.acceleration = [0, 0, 0];               // Last known acceleration [ax, ay, az]
        
        // Timestamp tracking
        this.lastTimestamp = null;
        this.lastUpdateTime = null;
        
        // Statistics
        this.updateCount = 0;
        this.positionHistory = [];
        
        console.log('Dead Reckoning initialized');
        console.log('- Initial position:', this.position);
        console.log('- Initial heading:', this.heading.toFixed(4), 'rad');
    }
    
    /**
     * Calculate time delta since last update
     * @param {number} timestamp - Current timestamp in milliseconds
     * @returns {number} Time delta in seconds
     */
    _calculateDeltaTime(timestamp) {
        if (!this.lastTimestamp) {
            this.lastTimestamp = timestamp;
            return 0.01; // Default small dt for first update
        }
        
        const dt = (timestamp - this.lastTimestamp) / 1000; // Convert ms to seconds
        this.lastTimestamp = timestamp;
        
        // Clamp dt to reasonable values (0.001s to 1s)
        return Math.max(0.001, Math.min(dt, 1.0));
    }
    
    /**
     * Update heading using gyroscope and magnetometer fusion
     * @param {number} angularVelocity - Angular velocity around vertical axis (rad/s)
     * @param {Array} magneticField - [Bx, By, Bz] magnetic field measurement
     * @param {number} dt - Time delta in seconds
     * @returns {number} Updated heading in radians
     */
    _updateHeading(angularVelocity, magneticField, dt) {
        // 1. Gyroscope integration (short-term accuracy)
        const gyroHeading = this.heading + angularVelocity * dt;
        
        // 2. Magnetometer heading calculation (long-term reference)
        let magHeading = this.heading; // Default to current heading
        if (magneticField && magneticField.length >= 2) {
            // Calculate heading from magnetometer (2D, ignoring tilt)
            // atan2(By, Bx) gives angle relative to magnetic North
            magHeading = Math.atan2(magneticField[1], magneticField[0]);
            
            // Adjust for magnetic declination if known (simplified: assume 0)
            // In real implementation, you'd subtract magnetic declination
        }
        
        // 3. Complementary filter: trust gyro more in short term
        const alpha = 0.98; // Gyro weight (0-1)
        const filteredHeading = alpha * gyroHeading + (1 - alpha) * magHeading;
        
        // Normalize heading to 0-2π range
        return this._normalizeAngle(filteredHeading);
    }
    
    /**
     * Update velocity using accelerometer data
     * @param {Array} acceleration - [ax, ay, az] in m/s²
     * @param {number} dt - Time delta in seconds
     * @returns {Array} Updated velocity [vx, vy, vz]
     */
    _updateVelocity(acceleration, dt) {
        // Simple Euler integration: v = v0 + a * dt
        return this.velocity.map((v, i) => v + acceleration[i] * dt);
    }
    
    /**
     * Update position using velocity and acceleration
     * @param {Array} acceleration - [ax, ay, az] in m/s²
     * @param {number} dt - Time delta in seconds
     * @returns {Array} Updated position [x, y, z]
     */
    _updatePosition(acceleration, dt) {
        // Position integration: p = p0 + v * dt + 0.5 * a * dt²
        return this.position.map((p, i) => 
            p + this.velocity[i] * dt + 0.5 * acceleration[i] * dt * dt
        );
    }
    
    /**
     * Normalize angle to 0-2π range
     * @param {number} angle - Angle in radians
     * @returns {number} Normalized angle
     */
    _normalizeAngle(angle) {
        while (angle < 0) angle += 2 * Math.PI;
        while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
        return angle;
    }
    
    /**
     * Main update function - integrates IMU data to estimate position
     * @param {Object} imuData - IMU measurements
     * @param {Array} imuData.acceleration - [ax, ay, az] in m/s²
     * @param {Array} imuData.angularVelocity - [ωx, ωy, ωz] in rad/s
     * @param {Array} imuData.magneticField - [Bx, By, Bz] in μT
     * @param {number} timestamp - Current timestamp in milliseconds
     * @returns {Object} Updated state {position, velocity, heading}
     */
    update(imuData, timestamp = Date.now()) {
        const { acceleration, angularVelocity, magneticField } = imuData;
        
        // Validate input
        if (!acceleration || acceleration.length !== 3) {
            throw new Error('Acceleration must be array of 3 values');
        }
        if (!angularVelocity || angularVelocity.length !== 3) {
            throw new Error('Angular velocity must be array of 3 values');
        }
        
        // Calculate time delta
        const dt = this._calculateDeltaTime(timestamp);
        
        // Store acceleration for position calculation
        this.acceleration = acceleration.slice();
        
        // Update heading (use z-axis angular velocity for 2D heading)
        const verticalAngularVelocity = angularVelocity[2]; // ωz
        this.heading = this._updateHeading(verticalAngularVelocity, magneticField, dt);
        
        // Rotate acceleration from body frame to world frame
        const worldAcceleration = this._rotateToWorldFrame(acceleration);
        
        // Update velocity
        this.velocity = this._updateVelocity(worldAcceleration, dt);
        
        // Update position
        this.position = this._updatePosition(worldAcceleration, dt);
        
        // Store history
        this.positionHistory.push({
            timestamp,
            position: [...this.position],
            velocity: [...this.velocity],
            heading: this.heading
        });
        
        // Keep only last 1000 positions
        if (this.positionHistory.length > 1000) {
            this.positionHistory.shift();
        }
        
        this.updateCount++;
        this.lastUpdateTime = timestamp;
        
        return this.getState();
    }
    
    /**
     * Rotate acceleration from body frame to world (NED) frame
     * @param {Array} bodyAccel - Acceleration in body frame [ax, ay, az]
     * @returns {Array} Acceleration in world frame
     */
    _rotateToWorldFrame(bodyAccel) {
        const cosH = Math.cos(this.heading);
        const sinH = Math.sin(this.heading);
        
        // Simple 2D rotation (ignoring pitch and roll for now)
        // In full implementation, you'd use a full rotation matrix
        const worldAccel = [
            bodyAccel[0] * cosH - bodyAccel[1] * sinH, // North
            bodyAccel[0] * sinH + bodyAccel[1] * cosH, // East
            bodyAccel[2] // Down (gravity + vertical motion)
        ];
        
        return worldAccel;
    }
    
    /**
     * Get current state
     * @returns {Object} Current state
     */
    getState() {
        return {
            position: [...this.position],
            velocity: [...this.velocity],
            heading: this.heading,
            headingDegrees: this.heading * 180 / Math.PI,
            updateCount: this.updateCount,
            lastUpdateTime: this.lastUpdateTime
        };
    }
    
    /**
     * Get position history
     * @returns {Array} Array of past positions with timestamps
     */
    getHistory() {
        return [...this.positionHistory];
    }
    
    /**
     * Reset dead reckoning to initial state
     * @param {Array} newPosition - Optional new position [x, y, z]
     * @param {number} newHeading - Optional new heading in radians
     */
    reset(newPosition = null, newHeading = null) {
        this.position = newPosition ? newPosition.slice() : [0, 0, 0];
        this.velocity = [0, 0, 0];
        this.heading = newHeading !== null ? newHeading : 0;
        this.acceleration = [0, 0, 0];
        this.lastTimestamp = null;
        this.positionHistory = [];
        this.updateCount = 0;
        
        console.log('Dead reckoning reset');
        console.log('- New position:', this.position);
        console.log('- New heading:', this.heading.toFixed(4), 'rad');
    }
    
    /**
     * Calculate total distance traveled
     * @returns {number} Distance in meters
     */
    getTotalDistance() {
        if (this.positionHistory.length < 2) return 0;
        
        let distance = 0;
        for (let i = 1; i < this.positionHistory.length; i++) {
            const prev = this.positionHistory[i-1].position;
            const curr = this.positionHistory[i].position;
            
            const dx = curr[0] - prev[0];
            const dy = curr[1] - prev[1];
            distance += Math.sqrt(dx*dx + dy*dy);
        }
        
        return distance;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeadReckoning;
}