// algorithms/sensor-fusion/test-imu.js
const IMUSimulator = require('./IMUSimulator');

console.log('=== IMU SIMULATOR COMPLETE TEST ===\n');

// Test 1: Default configuration
console.log('=== Test 1: Default Configuration ===');
const imu1 = new IMUSimulator();

// Test 2: Custom configuration
console.log('\n=== Test 2: Custom Configuration ===');
const imu2 = new IMUSimulator({
    accelNoise: 0.05,
    gyroNoise: 0.005,
    magNoise: 0.1
});

// Test 3: Accelerometer Model
console.log('\n=== Test 3: Accelerometer Model ===');
const trueAcceleration = [0.1, 0.2, 9.8];
console.log('True acceleration:', trueAcceleration.map(a => a.toFixed(4)));

for (let i = 0; i < 3; i++) {
    const noisyAccel = imu1.addAccelerometerNoise(trueAcceleration);
    console.log(`Measurement ${i + 1}:`, noisyAccel.map(a => a.toFixed(4)));
}

// Test 4: Gyroscope Model with Random Walk
console.log('\n=== Test 4: Gyroscope Model ===');
const trueAngularVelocity = [0.1, 0.05, 0.02];
console.log('True angular velocity:', trueAngularVelocity.map(ω => ω.toFixed(4)));

let time = 0;
const dt = 0.1;
for (let i = 0; i < 3; i++) {
    const noisyGyro = imu1.addGyroscopeNoise(trueAngularVelocity, dt);
    time += dt;
    console.log(`Time ${time.toFixed(1)}s:`, noisyGyro.map(ω => ω.toFixed(4)));
}

// Test 5: Magnetometer Model
console.log('\n=== Test 5: Magnetometer Model ===');
// Earth's magnetic field at mid-latitudes: ~25-65 μT horizontal, ~45 μT vertical
const trueMagneticField = [25.0, 0.0, 45.0]; // [Bx, By, Bz] in μT
console.log('True magnetic field:', trueMagneticField.map(b => b.toFixed(2)));

for (let i = 0; i < 3; i++) {
    const noisyMag = imu1.addMagnetometerNoise(trueMagneticField);
    console.log(`Measurement ${i + 1}:`, noisyMag.map(b => b.toFixed(2)));
    
    // Calculate heading from magnetometer (simplified)
    const heading = Math.atan2(noisyMag[1], noisyMag[0]) * 180 / Math.PI;
    console.log(`  Calculated heading: ${heading.toFixed(1)}°`);
}

// Test 6: All sensors together
console.log('\n=== Test 6: Combined Sensor Test ===');
const imu3 = new IMUSimulator();

console.log('Simulating all sensors simultaneously:');
const accel = imu3.addAccelerometerNoise([0, 0, 9.8]);
const gyro = imu3.addGyroscopeNoise([0.05, 0, 0], 0.1);
const mag = imu3.addMagnetometerNoise([25, 0, 45]);

console.log('Accelerometer:', accel.map(a => a.toFixed(4)));
console.log('Gyroscope:', gyro.map(g => g.toFixed(4)));
console.log('Magnetometer:', mag.map(m => m.toFixed(2)));

// Test 7: Get current state
console.log('\n=== Test 7: IMU State Inspection ===');
const state = imu3.getState();
console.log('Current IMU state:');
console.log('- Noise levels:', state.noiseLevels);
console.log('- Biases:', {
    accel: state.biases.accelerometer.toFixed(4),
    gyro: state.biases.gyroscope.toFixed(4)
});
console.log('- Gyro random walk:', {
    x: state.gyroRandomWalk.x.toFixed(6),
    y: state.gyroRandomWalk.y.toFixed(6),
    z: state.gyroRandomWalk.z.toFixed(6)
});
console.log('- Mag calibration:', {
    scale: state.magCalibration.scale.toFixed(4),
    offset: state.magCalibration.offset.toFixed(4)
});

console.log('\n✅ IMU Simulator complete! All three sensor models implemented.');
console.log('✓ Accelerometer: bias + white noise');
console.log('✓ Gyroscope: bias + random walk');
console.log('✓ Magnetometer: calibration errors + white noise');