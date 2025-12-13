// algorithms/simulation/debug-test.js
console.log('Debug: Testing module imports...\n');

try {
    console.log('1. Testing IMUSimulator import...');
    const IMUSimulator = require('../sensor-fusion/IMUSimulator');
    console.log('   ✓ IMUSimulator imported successfully');
    
    console.log('\n2. Testing DeadReckoning import...');
    const DeadReckoning = require('../sensor-fusion/DeadReckoning');
    console.log('   ✓ DeadReckoning imported successfully');
    
    console.log('\n3. Testing GPSSimulator import...');
    const GPSSimulator = require('../sensor-fusion/GPSSimulator');
    console.log('   ✓ GPSSimulator imported successfully');
    
    console.log('\n4. Testing SensorFusion import...');
    const SensorFusion = require('../sensor-fusion/SensorFusion');
    console.log('   ✓ SensorFusion imported successfully');
    
    console.log('\n5. Testing RouteGenerator import...');
    const RouteGenerator = require('../routing/RouteGenerator');
    console.log('   ✓ RouteGenerator imported successfully');
    
    console.log('\n6. Testing MetricsTracker import...');
    const MetricsTracker = require('./MetricsTracker');
    console.log('   ✓ MetricsTracker imported successfully');
    
    console.log('\n✅ All imports successful!');
    
} catch (error) {
    console.error('\n❌ Import error:', error.message);
    console.error('Stack:', error.stack);
    
    // Show current directory
    console.log('\nCurrent directory:', __dirname);
    console.log('Parent directory:', require('path').dirname(__dirname));
    
    // List files in sensor-fusion
    const fs = require('fs');
    const sensorFusionPath = require('path').join(__dirname, '../sensor-fusion');
    console.log('\nFiles in sensor-fusion directory:');
    try {
        const files = fs.readdirSync(sensorFusionPath);
        files.forEach(file => console.log('  -', file));
    } catch (e) {
        console.log('Cannot read sensor-fusion directory:', e.message);
    }
}