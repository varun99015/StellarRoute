// algorithms/sensor-fusion/SensorFusion.js
class SensorFusion {
    constructor(config = {}) {
        // Fusion algorithm selection
        this.fusionMethod = config.method || 'complementary'; // 'complementary' or 'kalman'
        
        // State variables
        this.fusedPosition = config.initialPosition || [0, 0];
        this.fusedVelocity = [0, 0];
        this.fusedHeading = config.initialHeading || 0;
        
        // Sensor status
        this.gpsActive = true;
        this.gpsLastUpdate = null;
        this.gpsOutageStart = null;
        this.imuActive = true;
        
        // Complementary filter parameters
        this.complementaryAlpha = config.alpha || 0.98; // Weight for IMU (0-1)
        this.minGPSAccuracy = config.minGPSAccuracy || 10; // meters
        
        // Kalman filter parameters (simple 2D)
        if (this.fusionMethod === 'kalman') {
            this._initKalmanFilter(config);
        }
        
        // Resync parameters
        this.resyncThreshold = config.resyncThreshold || 50; // meters
        this.maxOutageTime = config.maxOutageTime || 30000; // 30 seconds in ms
        
        // Performance tracking
        this.updateCount = 0;
        this.gpsUpdateCount = 0;
        this.imuUpdateCount = 0;
        this.resyncCount = 0;
        this.positionHistory = [];
        this.errorHistory = [];
        
        console.log('Sensor Fusion initialized');
        console.log('- Method:', this.fusionMethod);
        console.log('- Initial position:', this.fusedPosition);
        console.log('- GPS outage max time:', this.maxOutageTime + 'ms');
    }
    
    /**
     * Initialize simple Kalman filter
     * @private
     */
    _initKalmanFilter(config) {
        // State: [x, y, vx, vy]
        this.kalmanState = config.initialState || [0, 0, 0, 0];
        
        // State covariance matrix (4x4)
        this.kalmanP = [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ];
        
        // Process noise covariance
        this.kalmanQ = config.processNoise || [
            [0.1, 0, 0, 0],
            [0, 0.1, 0, 0],
            [0, 0, 0.1, 0],
            [0, 0, 0, 0.1]
        ];
        
        // Measurement noise covariance (GPS)
        this.kalmanR = config.measurementNoise || [
            [25, 0],   // GPS position variance
            [0, 25]
        ];
        
        console.log('Kalman filter initialized');
    }
    
    /**
     * Main update function - fuses IMU and GPS data
     * @param {Object} imuData - IMU state from dead reckoning
     * @param {Object} gpsData - GPS measurement
     * @param {number} timestamp - Current timestamp
     * @returns {Object} Fused position and status
     */
    update(imuData, gpsData, timestamp = Date.now()) {
        this.updateCount++;
        
        // Validate IMU data
        if (!imuData || !imuData.position) {
            console.warn('SensorFusion: Invalid IMU data');
            this.imuActive = false;
            return this.getState();
        }
        
        this.imuUpdateCount++;
        const imuPosition = imuData.position.slice(0, 2); // Use only x,y
        
        // Check GPS status
        let gpsPosition = null;
        let gpsAccuracy = Infinity;
        
        if (gpsData && gpsData.position && Array.isArray(gpsData.position)) {
            gpsPosition = gpsData.position.slice(0, 2);
            gpsAccuracy = gpsData.accuracy || this.minGPSAccuracy;
            this.gpsUpdateCount++;
            this.gpsLastUpdate = timestamp;
            
            // GPS just became active after outage
            if (!this.gpsActive) {
                this._handleGPSRecovery(gpsPosition, imuPosition, timestamp);
            }
            
            this.gpsActive = true;
            this.gpsOutageStart = null;
        } else {
            // GPS is unavailable
            if (this.gpsActive) {
                this.gpsOutageStart = timestamp;
                console.log('GPS signal lost, switching to IMU only');
            }
            this.gpsActive = false;
        }
        
        // Perform fusion based on selected method
        let fusedResult;
        if (this.fusionMethod === 'kalman' && this.gpsActive) {
            fusedResult = this._kalmanFilterUpdate(imuPosition, gpsPosition, timestamp);
        } else {
            fusedResult = this._complementaryFilterUpdate(imuPosition, gpsPosition, gpsAccuracy, timestamp);
        }
        
        // Handle prolonged GPS outage
        if (!this.gpsActive && this.gpsOutageStart) {
            const outageDuration = timestamp - this.gpsOutageStart;
            if (outageDuration > this.maxOutageTime) {
                console.warn(`GPS outage prolonged (${outageDuration}ms), IMU drift may be significant`);
            }
        }
        
        // Update state
        this.fusedPosition = fusedResult.position;
        this.fusedVelocity = fusedResult.velocity || [0, 0];
        this.fusedHeading = imuData.heading || this.fusedHeading;
        
        // Record history
        this._recordHistory({
            timestamp,
            imuPosition,
            gpsPosition,
            fusedPosition: this.fusedPosition,
            gpsActive: this.gpsActive,
            method: this.fusionMethod
        });
        
        return this.getState();
    }
    
    /**
     * Complementary filter implementation
     * @private
     */
    _complementaryFilterUpdate(imuPosition, gpsPosition, gpsAccuracy, timestamp) {
        let resultPosition;
        
        if (!gpsPosition || !this.gpsActive) {
            // GPS outage - use IMU only with high trust
            const imuTrust = 0.95;
            resultPosition = [
                this.fusedPosition[0] + (imuPosition[0] - this.fusedPosition[0]) * imuTrust,
                this.fusedPosition[1] + (imuPosition[1] - this.fusedPosition[1]) * imuTrust
            ];
        } else {
            // Both sensors available - use complementary filter
            
            // Adjust alpha based on GPS accuracy
            let alpha = this.complementaryAlpha;
            if (gpsAccuracy < this.minGPSAccuracy) {
                // Good GPS accuracy - trust GPS more
                alpha = Math.max(0.7, alpha - 0.1);
            }
            
            // Calculate change from IMU (dead reckoning)
            const imuDelta = [
                imuPosition[0] - this.fusedPosition[0],
                imuPosition[1] - this.fusedPosition[1]
            ];
            
            // Fuse: weighted combination of IMU delta and GPS measurement
            resultPosition = [
                this.fusedPosition[0] + alpha * imuDelta[0] + (1 - alpha) * (gpsPosition[0] - this.fusedPosition[0]),
                this.fusedPosition[1] + alpha * imuDelta[1] + (1 - alpha) * (gpsPosition[1] - this.fusedPosition[1])
            ];
            
            // Simple velocity estimation
            if (this.gpsLastUpdate && this.positionHistory.length > 0) {
                const lastUpdate = this.positionHistory[this.positionHistory.length - 1];
                const dt = (timestamp - lastUpdate.timestamp) / 1000;
                if (dt > 0) {
                    this.fusedVelocity = [
                        (resultPosition[0] - lastUpdate.fusedPosition[0]) / dt,
                        (resultPosition[1] - lastUpdate.fusedPosition[1]) / dt
                    ];
                }
            }
        }
        
        return {
            position: resultPosition,
            velocity: this.fusedVelocity
        };
    }
    
    /**
     * Simple Kalman filter implementation
     * @private
     */
    _kalmanFilterUpdate(imuPosition, gpsPosition, timestamp) {
        if (!this.gpsActive) {
            // During GPS outage, just predict using IMU
            return {
                position: imuPosition,
                velocity: this.fusedVelocity
            };
        }
        
        // Prediction step (using IMU)
        const dt = this.gpsLastUpdate ? (timestamp - this.gpsLastUpdate) / 1000 : 0.1;
        
        // State transition: x = x + v*dt, v = v (constant velocity model)
        const predictedState = [
            this.kalmanState[0] + this.kalmanState[2] * dt,
            this.kalmanState[1] + this.kalmanState[3] * dt,
            this.kalmanState[2], // vx stays same
            this.kalmanState[3]  // vy stays same
        ];
        
        // Update covariance (simplified)
        // P = F * P * F^T + Q
        // For simplicity, we'll just add process noise
        for (let i = 0; i < 4; i++) {
            this.kalmanP[i][i] += this.kalmanQ[i][i];
        }
        
        // Update step (using GPS)
        if (gpsPosition) {
            // Measurement residual
            const y = [
                gpsPosition[0] - predictedState[0],
                gpsPosition[1] - predictedState[1]
            ];
            
            // Kalman gain (simplified 2D)
            const S = [
                this.kalmanP[0][0] + this.kalmanR[0][0],
                this.kalmanP[1][1] + this.kalmanR[1][1]
            ];
            
            const K = [
                this.kalmanP[0][0] / S[0],
                this.kalmanP[1][1] / S[1]
            ];
            
            // Update state
            this.kalmanState = [
                predictedState[0] + K[0] * y[0],
                predictedState[1] + K[1] * y[1],
                predictedState[2],
                predictedState[3]
            ];
            
            // Update covariance (simplified)
            this.kalmanP[0][0] *= (1 - K[0]);
            this.kalmanP[1][1] *= (1 - K[1]);
        } else {
            this.kalmanState = predictedState;
        }
        
        return {
            position: [this.kalmanState[0], this.kalmanState[1]],
            velocity: [this.kalmanState[2], this.kalmanState[3]]
        };
    }
    
    /**
     * Handle GPS recovery after outage
     * @private
     */
    _handleGPSRecovery(gpsPosition, imuPosition, timestamp) {
        console.log('GPS signal recovered');
        
        // Calculate discrepancy between IMU and GPS
        const discrepancy = Math.sqrt(
            Math.pow(gpsPosition[0] - imuPosition[0], 2) +
            Math.pow(gpsPosition[1] - imuPosition[1], 2)
        );
        
        console.log(`GPS-IMU discrepancy: ${discrepancy.toFixed(1)}m`);
        
        if (discrepancy > this.resyncThreshold) {
            // Large discrepancy - reset to GPS position
            console.log(`Large discrepancy (${discrepancy.toFixed(1)}m > ${this.resyncThreshold}m), resyncing to GPS`);
            this.fusedPosition = [...gpsPosition];
            this.resyncCount++;
            
            // Reset Kalman filter if using it
            if (this.fusionMethod === 'kalman') {
                this.kalmanState[0] = gpsPosition[0];
                this.kalmanState[1] = gpsPosition[1];
            }
        } else {
            // Small discrepancy - gradual resync
            console.log('Small discrepancy, gradual resync');
            const resyncFactor = 0.3;
            this.fusedPosition = [
                this.fusedPosition[0] + (gpsPosition[0] - this.fusedPosition[0]) * resyncFactor,
                this.fusedPosition[1] + (gpsPosition[1] - this.fusedPosition[1]) * resyncFactor
            ];
        }
    }
    
    /**
     * Record position history
     * @private
     */
    _recordHistory(entry) {
        this.positionHistory.push(entry);
        
        // Keep last 1000 entries
        if (this.positionHistory.length > 1000) {
            this.positionHistory.shift();
        }
        
        // Calculate and record error if we have truth data
        if (entry.truePosition) {
            const error = Math.sqrt(
                Math.pow(entry.fusedPosition[0] - entry.truePosition[0], 2) +
                Math.pow(entry.fusedPosition[1] - entry.truePosition[1], 2)
            );
            
            this.errorHistory.push({
                timestamp: entry.timestamp,
                error,
                gpsActive: entry.gpsActive
            });
            
            if (this.errorHistory.length > 1000) {
                this.errorHistory.shift();
            }
        }
    }
    
    /**
     * Get current state
     * @returns {Object} Current fused state
     */
    getState() {
        return {
            position: [...this.fusedPosition],
            velocity: [...this.fusedVelocity],
            heading: this.fusedHeading,
            gpsActive: this.gpsActive,
            gpsOutageDuration: this.gpsOutageStart ? 
                Date.now() - this.gpsOutageStart : 0,
            updateCount: this.updateCount,
            gpsUpdateCount: this.gpsUpdateCount,
            imuUpdateCount: this.imuUpdateCount,
            resyncCount: this.resyncCount
        };
    }
    
    /**
     * Get performance statistics
     * @returns {Object} Performance statistics
     */
    getStats() {
        const errors = this.errorHistory.map(e => e.error);
        const gpsErrors = this.errorHistory.filter(e => e.gpsActive).map(e => e.error);
        const imuOnlyErrors = this.errorHistory.filter(e => !e.gpsActive).map(e => e.error);
        
        const calculateStats = (errorArray) => {
            if (errorArray.length === 0) return { avg: 0, max: 0, min: 0 };
            
            return {
                avg: errorArray.reduce((a, b) => a + b, 0) / errorArray.length,
                max: Math.max(...errorArray),
                min: Math.min(...errorArray)
            };
        };
        
        return {
            totalUpdates: this.updateCount,
            gpsUtilization: (this.gpsUpdateCount / this.updateCount * 100).toFixed(1) + '%',
            resyncEvents: this.resyncCount,
            errorStats: {
                all: calculateStats(errors),
                withGPS: calculateStats(gpsErrors),
                imuOnly: calculateStats(imuOnlyErrors)
            },
            currentOutage: this.gpsOutageStart ? 
                (Date.now() - this.gpsOutageStart) / 1000 + 's' : 'none'
        };
    }
    
    /**
     * Get position history
     * @param {number} limit - Maximum entries to return
     * @returns {Array} Position history
     */
    getHistory(limit = 100) {
        return this.positionHistory.slice(-limit);
    }
    
    /**
     * Reset sensor fusion
     * @param {Array} newPosition - Optional new position
     * @param {number} newHeading - Optional new heading
     */
    reset(newPosition = null, newHeading = null) {
        this.fusedPosition = newPosition || [0, 0];
        this.fusedVelocity = [0, 0];
        this.fusedHeading = newHeading !== null ? newHeading : 0;
        
        this.gpsActive = true;
        this.gpsLastUpdate = null;
        this.gpsOutageStart = null;
        
        this.updateCount = 0;
        this.gpsUpdateCount = 0;
        this.imuUpdateCount = 0;
        this.resyncCount = 0;
        
        this.positionHistory = [];
        this.errorHistory = [];
        
        if (this.fusionMethod === 'kalman') {
            this._initKalmanFilter({});
        }
        
        console.log('Sensor Fusion reset');
        return this;
    }
    
    /**
     * Change fusion method
     * @param {string} method - 'complementary' or 'kalman'
     */
    setFusionMethod(method) {
        if (!['complementary', 'kalman'].includes(method)) {
            throw new Error('Method must be "complementary" or "kalman"');
        }
        
        this.fusionMethod = method;
        
        if (method === 'kalman') {
            this._initKalmanFilter({});
        }
        
        console.log(`Fusion method changed to: ${method}`);
        return this;
    }
    
    /**
     * Set complementary filter parameter
     * @param {number} alpha - Weight for IMU (0-1)
     */
    setAlpha(alpha) {
        if (alpha < 0 || alpha > 1) {
            throw new Error('Alpha must be between 0 and 1');
        }
        
        this.complementaryAlpha = alpha;
        console.log(`Complementary filter alpha set to: ${alpha}`);
        return this;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SensorFusion;
}