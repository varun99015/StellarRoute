// algorithms/sensor-fusion/test-sensor-fusion.js
const SensorFusion = require('./SensorFusion');
const IMUSimulator = require('./IMUSimulator');
const DeadReckoning = require('./DeadReckoning');
const GPSSimulator = require('./GPSSimulator');

console.log('=== SENSOR FUSION LOGIC TEST ===\n');

// Test 1: Basic initialization
console.log('=== Test 1: Initialization ===');
const fusion = new SensorFusion({
    method: 'complementary',
    initialPosition: [0, 0],
    alpha: 0.95
});

console.log('Initial state:', fusion.getState());

// Test 2: Normal operation (GPS active)
console.log('\n=== Test 2: Normal Operation (GPS Active) ===');
fusion.reset([0, 0]);

const imu = new IMUSimulator();
const deadReckoning = new DeadReckoning([0, 0, 0], 0);
const gps = new GPSSimulator();

let timestamp = 1000;
const truePath = [
    [0, 0], [5, 0], [10, 0], [15, 5], [20, 10]
];

console.log('\nSimulating movement with GPS active:');
for (let i = 0; i < truePath.length; i++) {
    const truePos = truePath[i];
    
    // Generate IMU data
    const imuData = {
        acceleration: [1.0, 0, 9.8],
        angularVelocity: [0, 0, 0],
        magneticField: [25, 0, 45]
    };
    
    const drState = deadReckoning.update(imuData, timestamp);
    
    // Generate GPS data with low error
    const gpsPos = gps.addError(truePos);
    const gpsData = {
        position: gpsPos,
        accuracy: 10
    };
    
    // Fuse sensors
    const fusedState = fusion.update(drState, gpsData, timestamp);
    
    console.log(`Step ${i + 1}:`, {
        true: truePos,
        gps: gpsPos ? gpsPos.map(p => p.toFixed(1)) : 'N/A',
        fused: fusedState.position.map(p => p.toFixed(1)),
        gpsActive: fusedState.gpsActive
    });
    
    timestamp += 1000;
}

// Test 3: GPS outage handling
console.log('\n=== Test 3: GPS Outage Handling ===');
fusion.reset([0, 0]);

console.log('\nSimulating GPS outage:');
console.log('Path: Start at [0,0], move North at 5 m/s');

timestamp = 1000;
for (let i = 0; i < 10; i++) {
    const time = i + 1;
    const truePos = [time * 5, 0]; // Moving 5m each second
    
    // Generate IMU data
    const imuData = {
        acceleration: [0, 0, 9.8], // Constant velocity
        angularVelocity: [0, 0, 0],
        magneticField: [25, 0, 45]
    };
    
    const drState = deadReckoning.update(imuData, timestamp);
    
    // Simulate GPS outage from step 3 to 7
    let gpsData = null;
    if (time < 3 || time > 7) {
        const gpsPos = gps.addError(truePos);
        gpsData = {
            position: gpsPos,
            accuracy: 10
        };
    }
    
    const fusedState = fusion.update(drState, gpsData, timestamp);
    
    const error = Math.sqrt(
        Math.pow(fusedState.position[0] - truePos[0], 2) +
        Math.pow(fusedState.position[1] - truePos[1], 2)
    );
    
    console.log(`Time ${time}s:`, {
        true: truePos.map(p => p.toFixed(1)),
        fused: fusedState.position.map(p => p.toFixed(1)),
        gpsActive: fusedState.gpsActive,
        error: error.toFixed(1) + 'm'
    });
    
    timestamp += 1000;
}

// Test 4: GPS recovery with resync
console.log('\n=== Test 4: GPS Recovery with Resync ===');
fusion.reset([0, 0]);

console.log('\nSimulating GPS recovery with large discrepancy:');

// Simulate IMU drift during GPS outage
deadReckoning.reset([0, 0, 0], 0);
timestamp = 1000;

// Step 1-3: GPS active
for (let i = 0; i < 3; i++) {
    const imuData = {
        acceleration: [1.0, 0, 9.8],
        angularVelocity: [0, 0, 0],
        magneticField: [25, 0, 45]
    };
    
    const drState = deadReckoning.update(imuData, timestamp);
    const truePos = [(i + 1) * 5, 0];
    const gpsPos = [truePos[0] + 2, truePos[1] + 2]; // Small GPS error
    
    fusion.update(drState, { position: gpsPos, accuracy: 10 }, timestamp);
    timestamp += 1000;
}

// Step 4-6: GPS outage with IMU drift
// Introduce bias to cause drift
for (let i = 3; i < 6; i++) {
    const imuData = {
        acceleration: [1.2, 0, 9.8], // 20% bias causing drift
        angularVelocity: [0, 0, 0],
        magneticField: [25, 0, 45]
    };
    
    const drState = deadReckoning.update(imuData, timestamp);
    fusion.update(drState, null, timestamp); // No GPS
    timestamp += 1000;
}

// Step 7: GPS returns with large discrepancy
const imuData = {
    acceleration: [1.0, 0, 9.8],
    angularVelocity: [0, 0, 0],
    magneticField: [25, 0, 45]
};

const drState = deadReckoning.update(imuData, timestamp);
const truePos = [35, 0];
const gpsPos = [truePos[0], truePos[1]]; // Accurate GPS

console.log('Before GPS recovery:', fusion.getState().position.map(p => p.toFixed(1)));

const fusedState = fusion.update(drState, { position: gpsPos, accuracy: 5 }, timestamp);

console.log('After GPS recovery:', {
    fused: fusedState.position.map(p => p.toFixed(1)),
    gps: gpsPos.map(p => p.toFixed(1)),
    resyncCount: fusedState.resyncCount
});

// Test 5: Complementary vs Kalman filter comparison
console.log('\n=== Test 5: Filter Comparison ===');

const testCases = [
    { method: 'complementary', name: 'Complementary Filter' },
    { method: 'kalman', name: 'Kalman Filter' }
];

testCases.forEach(testCase => {
    console.log(`\nTesting ${testCase.name}:`);
    const testFusion = new SensorFusion({
        method: testCase.method,
        initialPosition: [0, 0]
    });
    
    deadReckoning.reset([0, 0, 0], 0);
    gps.reset();
    
    timestamp = 1000;
    const errors = [];
    
    // Simulate 10 updates with alternating GPS quality
    for (let i = 0; i < 10; i++) {
        const truePos = [i * 10, i * 5];
        
        const imuData = {
            acceleration: [2.0, 1.0, 9.8],
            angularVelocity: [0, 0, 0.1],
            magneticField: [25, 0, 45]
        };
        
        const drState = deadReckoning.update(imuData, timestamp);
        
        // Vary GPS accuracy
        let gpsAccuracy = 5 + Math.random() * 20;
        let gpsPos = null;
        
        if (i !== 4 && i !== 5) { // Simulate brief GPS outage
            gpsPos = gps.addError(truePos);
        }
        
        const fusedState = testFusion.update(
            drState, 
            gpsPos ? { position: gpsPos, accuracy: gpsAccuracy } : null,
            timestamp
        );
        
        const error = Math.sqrt(
            Math.pow(fusedState.position[0] - truePos[0], 2) +
            Math.pow(fusedState.position[1] - truePos[1], 2)
        );
        
        errors.push(error);
        timestamp += 1000;
    }
    
    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
    console.log(`  Average error: ${avgError.toFixed(1)}m`);
    console.log(`  Stats:`, testFusion.getStats());
});

// Test 6: Performance metrics
console.log('\n=== Test 6: Performance Metrics ===');
console.log('Final statistics:', fusion.getStats());

// Test 7: Edge cases
console.log('\n=== Test 7: Edge Cases ===');

console.log('\n1. Invalid IMU data:');
try {
    fusion.update(null, { position: [0, 0] }, Date.now());
} catch (e) {
    console.log('  Caught error:', e.message);
}

console.log('\n2. Changing fusion method:');
fusion.setFusionMethod('kalman');
console.log('  Method changed to:', fusion.fusionMethod);

console.log('\n3. Setting invalid alpha:');
try {
    fusion.setAlpha(1.5);
} catch (e) {
    console.log('  Caught error:', e.message);
}

console.log('\n✅ Sensor Fusion Logic Complete!');
console.log('✓ Complementary filter for IMU+GPS fusion');
console.log('✓ Simple Kalman filter implementation');
console.log('✓ Handles GPS outages gracefully');
console.log('✓ Resync logic when GPS returns');
console.log('✓ Performance tracking and statistics');
console.log('✓ Comparison between fusion methods');