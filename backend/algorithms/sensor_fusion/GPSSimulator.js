// algorithms/sensor-fusion/GPSSimulator.js
class GPSSimulator {
    constructor(config = {}) {
        // Risk level: 'low', 'medium', 'high'
        this.riskLevel = config.initialRisk || 'low';
        
        // Error state that persists over time
        this.errorState = {
            drift: [0, 0],           // Drift vector [dx, dy] in meters
            lastJumpTime: 0,         // Timestamp of last error jump
            satelliteCount: 12,      // Number of visible satellites
            hdop: 1.2,              // Horizontal Dilution of Precision
            outage: false,           // Whether GPS signal is lost
            outageStartTime: null,   // When outage started
            lastGoodPosition: null   // Last known good position
        };
        
        // Error magnitude configuration by risk level (in meters)
        this.errorConfig = {
            low: {
                random: { min: 5, max: 15 },
                drift: { max: 0.1, step: 0.01 },
                jump: { probability: 0.001, max: 20 },
                dropout: { probability: 0.0001, duration: { min: 1, max: 5 } }
            },
            medium: {
                random: { min: 30, max: 100 },
                drift: { max: 1.0, step: 0.1 },
                jump: { probability: 0.01, max: 50 },
                dropout: { probability: 0.001, duration: { min: 10, max: 30 } }
            },
            high: {
                random: { min: 100, max: 500 },
                drift: { max: 5.0, step: 0.5 },
                jump: { probability: 0.05, max: 200 },
                dropout: { probability: 0.01, duration: { min: 60, max: 300 } }
            }
        };
        
        // Satellite configuration
        this.satelliteConfig = {
            total: 24,               // Total GPS satellites
            minForFix: 4,           // Minimum satellites needed for position
            stormEffect: 0.7        // Storm reduces visible satellites to 70%
        };
        
        // History for error analysis
        this.errorHistory = [];
        this.maxHistorySize = 1000;
        
        console.log('GPS Simulator initialized');
        console.log('- Initial risk level:', this.riskLevel);
        console.log('- Error config:', this.errorConfig[this.riskLevel]);
    }
    
    /**
     * Set the current risk level
     * @param {string} level - 'low', 'medium', or 'high'
     */
    setRiskLevel(level) {
        if (!['low', 'medium', 'high'].includes(level)) {
            throw new Error('Risk level must be "low", "medium", or "high"');
        }
        
        const previousLevel = this.riskLevel;
        this.riskLevel = level;
        
        // Reset drift when risk level changes
        if (previousLevel !== level) {
            this.errorState.drift = [0, 0];
            console.log(`GPS risk level changed from ${previousLevel} to ${level}, drift reset`);
        }
        
        return this;
    }
    
    /**
     * Simulate satellite dropouts during storms
     * @param {boolean} stormActive - Whether a storm is active
     */
    simulateStorm(stormActive) {
        if (stormActive) {
            // Reduce visible satellites during storm
            const reductionFactor = this.satelliteConfig.stormEffect;
            this.errorState.satelliteCount = Math.max(
                this.satelliteConfig.minForFix,
                Math.floor(this.satelliteConfig.total * reductionFactor * Math.random())
            );
            this.errorState.hdop = 2.0 + Math.random() * 3.0; // Poor HDOP during storm
        } else {
            // Normal satellite conditions
            this.errorState.satelliteCount = 8 + Math.floor(Math.random() * 8);
            this.errorState.hdop = 1.0 + Math.random() * 0.5;
        }
        
        return this;
    }
    
    /**
     * Simulate GPS outage
     * @param {boolean} active - Whether outage is active
     * @param {number} duration - Optional fixed duration in seconds
     */
    simulateOutage(active, duration = null) {
        this.errorState.outage = active;
        
        if (active) {
            this.errorState.outageStartTime = Date.now();
            this.errorState.satelliteCount = 0;
            console.log(`GPS outage started${duration ? ` for ${duration}s` : ''}`);
        } else {
            const outageDuration = this.errorState.outageStartTime ? 
                (Date.now() - this.errorState.outageStartTime) / 1000 : 0;
            console.log(`GPS outage ended after ${outageDuration.toFixed(1)}s`);
            this.errorState.outageStartTime = null;
        }
        
        return this;
    }
    
    /**
     * Add GPS error to true position
     * @param {Array} truePosition - [latitude, longitude] or [x, y] in meters
     * @param {number} timestamp - Optional timestamp for time-based effects
     * @returns {Array|null} Position with error, or null if GPS is unavailable
     */
    addError(truePosition, timestamp = Date.now()) {
        // Check for outage
        if (this.errorState.outage) {
            this._recordError(truePosition, null);
            return null;
        }
        
        // Check if we have enough satellites
        if (this.errorState.satelliteCount < this.satelliteConfig.minForFix) {
            console.log(`GPS: Insufficient satellites (${this.errorState.satelliteCount}/${this.satelliteConfig.minForFix})`);
            this._recordError(truePosition, null);
            return null;
        }
        
        const config = this.errorConfig[this.riskLevel];
        let error = [0, 0];
        
        // 1. Add random error (white noise)
        error = this._addRandomError(error, config.random);
        
        // 2. Add drift error (slow, persistent error)
        error = this._addDriftError(error, config.drift, timestamp);
        
        // 3. Add jump error (sudden large error)
        error = this._addJumpError(error, config.jump, timestamp);
        
        // Apply error to true position
        const noisyPosition = [
            truePosition[0] + error[0],
            truePosition[1] + error[1]
        ];
        
        // Store last good position for outage recovery
        this.errorState.lastGoodPosition = noisyPosition;
        
        // Record error for analysis
        this._recordError(truePosition, noisyPosition);
        
        return noisyPosition;
    }
    
    /**
     * Add random error (white noise)
     * @private
     */
    _addRandomError(error, randomConfig) {
        const magnitude = randomConfig.min + Math.random() * (randomConfig.max - randomConfig.min);
        const angle = Math.random() * 2 * Math.PI;
        
        return [
            error[0] + Math.cos(angle) * magnitude,
            error[1] + Math.sin(angle) * magnitude
        ];
    }
    
    /**
     * Add drift error (random walk)
     * @private
     */
    _addDriftError(error, driftConfig, timestamp) {
        // Update drift vector
        this.errorState.drift[0] += (Math.random() - 0.5) * 2 * driftConfig.step;
        this.errorState.drift[1] += (Math.random() - 0.5) * 2 * driftConfig.step;
        
        // Clamp drift magnitude
        const currentMagnitude = Math.sqrt(
            this.errorState.drift[0]**2 + this.errorState.drift[1]**2
        );
        
        if (currentMagnitude > driftConfig.max) {
            const scale = driftConfig.max / currentMagnitude;
            this.errorState.drift[0] *= scale;
            this.errorState.drift[1] *= scale;
        }
        
        return [
            error[0] + this.errorState.drift[0],
            error[1] + this.errorState.drift[1]
        ];
    }
    
    /**
     * Add jump error (sudden large error)
     * @private
     */
    _addJumpError(error, jumpConfig, timestamp) {
        const timeSinceLastJump = timestamp - this.errorState.lastJumpTime;
        
        // Check if jump should occur (probability increases with time)
        const jumpProbability = Math.min(
            jumpConfig.probability * (timeSinceLastJump / 1000), // Convert ms to seconds
            0.1 // Cap probability
        );
        
        if (Math.random() < jumpProbability) {
            this.errorState.lastJumpTime = timestamp;
            
            const jumpMagnitude = Math.random() * jumpConfig.max;
            const jumpAngle = Math.random() * 2 * Math.PI;
            
            // Apply jump to drift state (persistent)
            this.errorState.drift[0] += Math.cos(jumpAngle) * jumpMagnitude;
            this.errorState.drift[1] += Math.sin(jumpAngle) * jumpMagnitude;
            
            console.log(`GPS: Position jump of ${jumpMagnitude.toFixed(1)}m at ${new Date(timestamp).toISOString()}`);
        }
        
        return error;
    }
    
    /**
     * Record error for analysis
     * @private
     */
    _recordError(truePosition, noisyPosition) {
        const errorEntry = {
            timestamp: Date.now(),
            riskLevel: this.riskLevel,
            truePosition: truePosition ? [...truePosition] : null,
            noisyPosition: noisyPosition ? [...noisyPosition] : null,
            error: noisyPosition ? this._calculateError(truePosition, noisyPosition) : null,
            outage: this.errorState.outage,
            satelliteCount: this.errorState.satelliteCount,
            hdop: this.errorState.hdop
        };
        
        this.errorHistory.push(errorEntry);
        
        // Keep history size manageable
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }
        
        return errorEntry;
    }
    
    /**
     * Calculate error magnitude
     * @private
     */
    _calculateError(truePos, noisyPos) {
        const dx = noisyPos[0] - truePos[0];
        const dy = noisyPos[1] - truePos[1];
        return Math.sqrt(dx*dx + dy*dy);
    }
    
    /**
     * Get GPS status information
     * @returns {Object} Current GPS status
     */
    getStatus() {
        return {
            riskLevel: this.riskLevel,
            outage: this.errorState.outage,
            satelliteCount: this.errorState.satelliteCount,
            hdop: this.errorState.hdop,
            drift: [...this.errorState.drift],
            lastGoodPosition: this.errorState.lastGoodPosition ? 
                [...this.errorState.lastGoodPosition] : null
        };
    }
    
    /**
     * Get error statistics
     * @returns {Object} Error statistics
     */
    getErrorStats() {
        const validErrors = this.errorHistory.filter(entry => entry.error !== null);
        
        if (validErrors.length === 0) {
            return {
                count: 0,
                averageError: 0,
                maxError: 0,
                outageCount: this.errorHistory.filter(e => e.outage).length
            };
        }
        
        const errors = validErrors.map(entry => entry.error);
        const averageError = errors.reduce((sum, e) => sum + e, 0) / errors.length;
        const maxError = Math.max(...errors);
        
        return {
            count: validErrors.length,
            averageError,
            maxError,
            outageCount: this.errorHistory.filter(e => e.outage).length,
            lastError: validErrors.length > 0 ? validErrors[validErrors.length - 1].error : 0
        };
    }
    
    /**
     * Get error history
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} Error history
     */
    getErrorHistory(limit = 100) {
        return this.errorHistory.slice(-limit);
    }
    
    /**
     * Reset GPS simulator
     */
    reset() {
        this.errorState = {
            drift: [0, 0],
            lastJumpTime: 0,
            satelliteCount: 12,
            hdop: 1.2,
            outage: false,
            outageStartTime: null,
            lastGoodPosition: null
        };
        
        this.errorHistory = [];
        
        console.log('GPS Simulator reset');
        return this;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GPSSimulator;
}