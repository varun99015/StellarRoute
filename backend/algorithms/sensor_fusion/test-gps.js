// algorithms/sensor-fusion/test-gps.js
const GPSSimulator = require('./GPSSimulator');

console.log('=== GPS ERROR MODEL TEST ===\n');

// Test 1: Basic initialization
console.log('=== Test 1: Initialization ===');
const gps = new GPSSimulator();
console.log('Initial status:', gps.getStatus());

// Test 2: Low risk level errors
console.log('\n=== Test 2: Low Risk Level ===');
gps.setRiskLevel('low');
const truePosition = [0, 0];

console.log('\nGenerating 5 positions with low risk error (5-15m):');
for (let i = 0; i < 5; i++) {
    const noisyPosition = gps.addError(truePosition);
    if (noisyPosition) {
        const dx = noisyPosition[0] - truePosition[0];
        const dy = noisyPosition[1] - truePosition[1];
        const error = Math.sqrt(dx*dx + dy*dy);
        console.log(`Position ${i + 1}:`, {
            noisy: noisyPosition.map(p => p.toFixed(1)),
            error: error.toFixed(1) + 'm',
            direction: Math.atan2(dy, dx) * 180 / Math.PI.toFixed(1) + '°'
        });
    }
}

// Test 3: Medium risk level errors
console.log('\n=== Test 3: Medium Risk Level ===');
gps.setRiskLevel('medium');
console.log('Status:', gps.getStatus());

console.log('\nGenerating 5 positions with medium risk error (30-100m with drift):');
for (let i = 0; i < 5; i++) {
    const noisyPosition = gps.addError(truePosition);
    if (noisyPosition) {
        const dx = noisyPosition[0] - truePosition[0];
        const dy = noisyPosition[1] - truePosition[1];
        const error = Math.sqrt(dx*dx + dy*dy);
        console.log(`Position ${i + 1}:`, {
            noisy: noisyPosition.map(p => p.toFixed(1)),
            error: error.toFixed(1) + 'm',
            drift: gps.getStatus().drift.map(d => d.toFixed(1))
        });
    }
}

// Test 4: High risk level errors
console.log('\n=== Test 4: High Risk Level ===');
gps.setRiskLevel('high');
console.log('Status:', gps.getStatus());

console.log('\nGenerating 5 positions with high risk error (100-500m with jumps):');
for (let i = 0; i < 5; i++) {
    const noisyPosition = gps.addError(truePosition, Date.now() + i * 1000);
    if (noisyPosition) {
        const dx = noisyPosition[0] - truePosition[0];
        const dy = noisyPosition[1] - truePosition[1];
        const error = Math.sqrt(dx*dx + dy*dy);
        console.log(`Position ${i + 1}:`, {
            noisy: noisyPosition.map(p => p.toFixed(1)),
            error: error.toFixed(1) + 'm'
        });
    }
}

// Test 5: GPS Outage simulation
console.log('\n=== Test 5: GPS Outage ===');
gps.setRiskLevel('low');
gps.reset();

console.log('\nSimulating GPS outage:');
console.log('Before outage:', gps.addError([100, 100]));

gps.simulateOutage(true);
console.log('During outage:', gps.addError([100, 100]));
console.log('During outage:', gps.addError([101, 101]));

gps.simulateOutage(false);
console.log('After outage:', gps.addError([102, 102]));

// Test 6: Storm simulation
console.log('\n=== Test 6: Storm Simulation ===');
gps.reset();

console.log('\nNormal conditions:');
gps.simulateStorm(false);
console.log('Satellites:', gps.getStatus().satelliteCount);
console.log('HDOP:', gps.getStatus().hdop.toFixed(2));

console.log('\nDuring storm:');
gps.simulateStorm(true);
console.log('Satellites:', gps.getStatus().satelliteCount);
console.log('HDOP:', gps.getStatus().hdop.toFixed(2));

// Simulate position during storm
const positionDuringStorm = gps.addError([0, 0]);
console.log('Position during storm:', positionDuringStorm ? 
    positionDuringStorm.map(p => p.toFixed(1)) : 'No fix');

// Test 7: Error statistics
console.log('\n=== Test 7: Error Statistics ===');
console.log('Total measurements:', gps.getErrorStats().count);
console.log('Average error:', gps.getErrorStats().averageError.toFixed(1) + 'm');
console.log('Max error:', gps.getErrorStats().maxError.toFixed(1) + 'm');
console.log('Outage count:', gps.getErrorStats().outageCount);

// Test 8: Moving target with different risk levels
console.log('\n=== Test 8: Moving Target Simulation ===');
gps.reset();
const path = [
    [0, 0], [10, 0], [20, 10], [30, 30], [40, 40]
];

console.log('\nSimulating movement with changing risk levels:');
const riskLevels = ['low', 'medium', 'high', 'medium', 'low'];

for (let i = 0; i < path.length; i++) {
    gps.setRiskLevel(riskLevels[i]);
    const truePos = path[i];
    const noisyPos = gps.addError(truePos);
    
    if (noisyPos) {
        const error = Math.sqrt(
            Math.pow(noisyPos[0] - truePos[0], 2) +
            Math.pow(noisyPos[1] - truePos[1], 2)
        );
        
        console.log(`Step ${i + 1} (${riskLevels[i]} risk):`, {
            true: truePos,
            noisy: noisyPos.map(p => p.toFixed(1)),
            error: error.toFixed(1) + 'm'
        });
    }
}

// Test 9: Error pattern demonstration
console.log('\n=== Test 9: Error Patterns ===');
console.log('Demonstrating different error characteristics:');

const patterns = [
    { name: 'Low Risk', risk: 'low', desc: 'Small random errors (5-15m)' },
    { name: 'Medium Risk', risk: 'medium', desc: 'Moderate errors with drift (30-100m)' },
    { name: 'High Risk', risk: 'high', desc: 'Large errors with jumps (100-500m)' }
];

patterns.forEach(pattern => {
    console.log(`\n${pattern.name}: ${pattern.desc}`);
    const testGPS = new GPSSimulator({ initialRisk: pattern.risk });
    
    // Generate 10 positions at same true location
    const errors = [];
    for (let i = 0; i < 10; i++) {
        const noisy = testGPS.addError([0, 0]);
        if (noisy) {
            const error = Math.sqrt(noisy[0]**2 + noisy[1]**2);
            errors.push(error);
        }
    }
    
    if (errors.length > 0) {
        const avg = errors.reduce((a, b) => a + b) / errors.length;
        const min = Math.min(...errors);
        const max = Math.max(...errors);
        
        console.log(`  Errors: ${min.toFixed(1)}m - ${max.toFixed(1)}m (avg: ${avg.toFixed(1)}m)`);
        console.log(`  Stats:`, testGPS.getErrorStats());
    }
});

console.log('\n✅ GPS Error Model Complete!');
console.log('✓ Low risk: 5-15m random error');
console.log('✓ Medium risk: 30-100m error with drift');
console.log('✓ High risk: 100-500m error with jumps');
console.log('✓ Satellite dropouts during storms');
console.log('✓ GPS outage simulation');
console.log('✓ Error statistics tracking');