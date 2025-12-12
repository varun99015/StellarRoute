// algorithms/sensor-fusion/IMUSimulator.js
class IMUSimulator {
    constructor(config = {}) {
        // Configurable noise levels for testing
        this.noiseLevels = {
            accelerometer: config.accelNoise || 0.01,     // m/s²
            gyroscope: config.gyroNoise || 0.001,         // rad/s
            magnetometer: config.magNoise || 0.05         // μT
        };
        
        // Initialize biases
        this.accelBias = this._generateBias(0.05);        // 0.05 m/s² max bias
        this.gyroBias = this._generateBias(0.01);         // 0.01 rad/s max bias
        
        // Initialize gyroscope random walk state
        this.gyroRandomWalkState = {
            x: 0,
            y: 0,
            z: 0
        };
        
        // Initialize magnetometer calibration errors
        this.magCalibrationError = this._generateCalibrationError();
        
        console.log('IMU Simulator initialized');
        console.log('- Noise levels:', this.noiseLevels);
        console.log('- Accelerometer bias:', this.accelBias.toFixed(4), 'm/s²');
        console.log('- Gyroscope bias:', this.gyroBias.toFixed(4), 'rad/s');
        console.log('- Magnetometer calibration:', {
            scale: this.magCalibrationError.scale.toFixed(4),
            offset: this.magCalibrationError.offset.toFixed(4)
        });
    }
    
    /**
     * Generate a random bias value
     * @param {number} maxBias - Maximum bias magnitude
     * @returns {number} Random bias between -maxBias and +maxBias
     */
    _generateBias(maxBias) {
        return (Math.random() - 0.5) * 2 * maxBias;
    }
    
    /**
     * Generate magnetometer calibration errors (scale and offset)
     * @returns {Object} {scale: number, offset: number}
     */
    _generateCalibrationError() {
        return {
            scale: 1 + (Math.random() - 0.5) * 0.1,   // 0.9 to 1.1 scale error
            offset: (Math.random() - 0.5) * 0.2       // -0.1 to +0.1 offset error
        };
    }
    
    /**
     * Accelerometer model: bias + white noise
     * @param {Array} trueAcceleration - [ax, ay, az] in m/s²
     * @returns {Array} Noisy acceleration measurement [ax, ay, az]
     */
    addAccelerometerNoise(trueAcceleration) {
        if (!Array.isArray(trueAcceleration) || trueAcceleration.length !== 3) {
            throw new Error('Acceleration must be an array of 3 values [ax, ay, az]');
        }
        
        // Generate independent white noise for each axis
        const noise = [
            (Math.random() - 0.5) * 2 * this.noiseLevels.accelerometer,
            (Math.random() - 0.5) * 2 * this.noiseLevels.accelerometer,
            (Math.random() - 0.5) * 2 * this.noiseLevels.accelerometer
        ];
        
        // Add bias to each axis (same bias for all axes in this model)
        const biased = trueAcceleration.map(a => a + this.accelBias);
        
        // Add white noise
        const noisyMeasurement = biased.map((a, i) => a + noise[i]);
        
        return noisyMeasurement;
    }
    
    /**
     * Gyroscope model: bias + random walk
     * @param {Array} trueAngularVelocity - [ωx, ωy, ωz] in rad/s
     * @param {number} dt - Time delta in seconds since last measurement
     * @returns {Array} Noisy angular velocity measurement [ωx, ωy, ωz]
     */
    addGyroscopeNoise(trueAngularVelocity, dt = 0.01) {
        if (!Array.isArray(trueAngularVelocity) || trueAngularVelocity.length !== 3) {
            throw new Error('Angular velocity must be an array of 3 values [ωx, ωy, ωz]');
        }
        
        if (dt <= 0) {
            throw new Error('Time delta must be positive');
        }
        
        // Random walk: integrate noise over time
        // Random walk noise grows with sqrt(dt)
        const randomWalkNoise = [
            (Math.random() - 0.5) * 2 * this.noiseLevels.gyroscope * Math.sqrt(dt),
            (Math.random() - 0.5) * 2 * this.noiseLevels.gyroscope * Math.sqrt(dt),
            (Math.random() - 0.5) * 2 * this.noiseLevels.gyroscope * Math.sqrt(dt)
        ];
        
        // Update random walk state (accumulates over time)
        this.gyroRandomWalkState.x += randomWalkNoise[0];
        this.gyroRandomWalkState.y += randomWalkNoise[1];
        this.gyroRandomWalkState.z += randomWalkNoise[2];
        
        // Add bias and random walk to true value
        const noisyMeasurement = [
            trueAngularVelocity[0] + this.gyroBias + this.gyroRandomWalkState.x,
            trueAngularVelocity[1] + this.gyroBias + this.gyroRandomWalkState.y,
            trueAngularVelocity[2] + this.gyroBias + this.gyroRandomWalkState.z
        ];
        
        return noisyMeasurement;
    }
    
    /**
     * Magnetometer model: calibration errors + white noise
     * @param {Array} trueMagneticField - [Bx, By, Bz] in μT (microtesla)
     * @returns {Array} Noisy magnetic field measurement [Bx, By, Bz]
     */
    addMagnetometerNoise(trueMagneticField) {
        if (!Array.isArray(trueMagneticField) || trueMagneticField.length !== 3) {
            throw new Error('Magnetic field must be an array of 3 values [Bx, By, Bz]');
        }
        
        const { scale, offset } = this.magCalibrationError;
        
        // Generate white noise for each axis
        const noise = [
            (Math.random() - 0.5) * 2 * this.noiseLevels.magnetometer,
            (Math.random() - 0.5) * 2 * this.noiseLevels.magnetometer,
            (Math.random() - 0.5) * 2 * this.noiseLevels.magnetometer
        ];
        
        // Apply calibration errors: scale error + offset error + noise
        const noisyMeasurement = trueMagneticField.map((value, i) => {
            // Scale error affects magnitude
            const scaled = value * scale;
            
            // Add offset error (systematic error)
            const withOffset = scaled + offset;
            
            // Add white noise
            return withOffset + noise[i];
        });
        
        return noisyMeasurement;
    }
    
    /**
     * Reset the gyroscope random walk state (useful for testing)
     */
    resetGyroRandomWalk() {
        this.gyroRandomWalkState = { x: 0, y: 0, z: 0 };
        console.log('Gyroscope random walk state reset to zero');
    }
    
    /**
     * Get current IMU state for debugging
     * @returns {Object} Current IMU parameters
     */
    getState() {
        return {
            noiseLevels: { ...this.noiseLevels },
            biases: {
                accelerometer: this.accelBias,
                gyroscope: this.gyroBias
            },
            gyroRandomWalk: { ...this.gyroRandomWalkState },
            magCalibration: { ...this.magCalibrationError }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IMUSimulator;
}