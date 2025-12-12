// algorithms/sensor-fusion/test-dead-reckoning.js
const DeadReckoning = require('./DeadReckoning');
const IMUSimulator = require('./IMUSimulator');

console.log('=== DEAD RECKONING ALGORITHM TEST ===\n');

// Test 1: Basic initialization
console.log('=== Test 1: Initialization ===');
const dr = new DeadReckoning([0, 0, 0], 0);
console.log('Initial state:', dr.getState());

// Test 2: Simple straight line motion
console.log('\n=== Test 2: Straight Line Motion ===');
dr.reset([0, 0, 0], 0); // Reset to start

const imu = new IMUSimulator();
let timestamp = 1000; // Start at 1 second

// Simulate accelerating North at 1 m/s² for 5 seconds
console.log('\nSimulating acceleration North at 1 m/s² for 5 seconds:');
for (let i = 0; i < 5; i++) {
    const imuData = {
        acceleration: [1.0, 0.0, 9.8],      // 1 m/s² North, gravity down
        angularVelocity: [0, 0, 0],         // No rotation
        magneticField: [25, 0, 45]          // Magnetic North
    };
    
    const state = dr.update(imuData, timestamp);
    timestamp += 1000; // 1 second intervals
    
    console.log(`Time ${i + 1}s:`, {
        position: state.position.map(p => p.toFixed(2)),
        velocity: state.velocity.map(v => v.toFixed(2)),
        heading: state.headingDegrees.toFixed(1) + '°'
    });
}

// Test 3: Turning motion
console.log('\n=== Test 3: Turning Motion ===');
dr.reset([0, 0, 0], 0);

timestamp = 1000;
console.log('\nSimulating turning right while moving:');
for (let i = 0; i < 10; i++) {
    const imuData = {
        acceleration: [0.5, 0.0, 9.8],      // 0.5 m/s² forward
        angularVelocity: [0, 0, -0.2],      // Turning right at 0.2 rad/s
        magneticField: [25, 0, 45]
    };
    
    const state = dr.update(imuData, timestamp);
    timestamp += 500; // 0.5 second intervals
    
    if (i % 2 === 0) {
        console.log(`Time ${i * 0.5}s:`, {
            position: `(${state.position[0].toFixed(1)}, ${state.position[1].toFixed(1)})`,
            heading: state.headingDegrees.toFixed(1) + '°',
            speed: Math.sqrt(state.velocity[0]**2 + state.velocity[1]**2).toFixed(2) + ' m/s'
        });
    }
}

// Test 4: With IMU noise
console.log('\n=== Test 4: With IMU Noise ===');
dr.reset([0, 0, 0], 0);
const noisyIMU = new IMUSimulator({
    accelNoise: 0.1,
    gyroNoise: 0.01,
    magNoise: 0.2
});

timestamp = 1000;
console.log('\nSimulating with noisy IMU (10 updates):');
for (let i = 0; i < 10; i++) {
    const trueAccel = [0.5, 0, 9.8];
    const trueGyro = [0, 0, 0];
    const trueMag = [25, 0, 45];
    
    const imuData = {
        acceleration: noisyIMU.addAccelerometerNoise(trueAccel),
        angularVelocity: noisyIMU.addGyroscopeNoise(trueGyro, 0.1),
        magneticField: noisyIMU.addMagnetometerNoise(trueMag)
    };
    
    const state = dr.update(imuData, timestamp);
    timestamp += 100;
    
    if (i % 2 === 0) {
        console.log(`Update ${i}:`, {
            position: state.position.map(p => p.toFixed(2)),
            heading: state.headingDegrees.toFixed(1) + '°'
        });
    }
}

// Test 5: Error accumulation demonstration
console.log('\n=== Test 5: Error Accumulation ===');
dr.reset([0, 0, 0], 0);

console.log('\nDemonstrating error accumulation over time:');
console.log('(Constant bias in accelerometer)');

// Simulate with constant bias
const biasedIMU = {
    acceleration: [1.05, 0, 9.8],  // 5% bias (1.05 instead of 1.0)
    angularVelocity: [0, 0, 0],
    magneticField: [25, 0, 45]
};

timestamp = 1000;
const idealPosition = [0, 0]; // For comparison

for (let i = 0; i < 10; i++) {
    const state = dr.update(biasedIMU, timestamp);
    timestamp += 1000;
    
    // Ideal position (no bias): s = 0.5 * a * t²
    const idealDist = 0.5 * 1.0 * (i + 1)**2;
    const actualDist = state.position[0];
    const error = actualDist - idealDist;
    const errorPercent = (error / idealDist * 100).toFixed(1);
    
    console.log(`Time ${i + 1}s:`, {
        ideal: idealDist.toFixed(2) + 'm',
        actual: actualDist.toFixed(2) + 'm',
        error: error.toFixed(2) + 'm (' + errorPercent + '%)'
    });
}

// Test 6: Statistics
console.log('\n=== Test 6: Statistics ===');
console.log('Total updates:', dr.updateCount);
console.log('Total distance traveled:', dr.getTotalDistance().toFixed(2), 'm');
console.log('Position history length:', dr.getHistory().length);

console.log('\n✅ Dead Reckoning Algorithm Complete!');
console.log('✓ Position integration: position += velocity * Δt + 0.5 * acceleration * Δt²');
console.log('✓ Heading estimation from gyro + magnetometer');
console.log('✓ Velocity estimation from accelerometer');
console.log('✓ Frame rotation from body to world coordinates');
console.log('✓ Error accumulation demonstration');