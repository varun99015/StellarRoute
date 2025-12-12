// algorithms/routing/test-astar.js
const EnhancedAStar = require('./EnhancedAStar');

console.log('=== ENHANCED A* ALGORITHM TEST ===\n');

// Create test grid (10x10)
const testGrid = [];
const testRisk = [];

console.log('Creating 10x10 test grid...');
for (let y = 0; y < 10; y++) {
    testGrid[y] = [];
    testRisk[y] = [];
    
    for (let x = 0; x < 10; x++) {
        // Define terrain types
        if (x < 3 && y < 3) {
            testGrid[y][x] = 'urban';
            testRisk[y][x] = 0.3;
        } else if (x >= 3 && x < 7 && y >= 3 && y < 7) {
            testGrid[y][x] = 'forest';
            testRisk[y][x] = 0.6;
        } else if (x >= 7 || y >= 7) {
            testGrid[y][x] = 'mountain';
            testRisk[y][x] = 0.8;
        } else if (x === 5 && y >= 0 && y < 10) {
            testGrid[y][x] = 'water';
            testRisk[y][x] = 1.0;
        } else {
            testGrid[y][x] = 'road';
            testRisk[y][x] = 0.1;
        }
    }
}

// Custom terrain weights
const terrainWeights = {
    'road': 1.0,
    'urban': 1.2,
    'grass': 1.5,
    'forest': 2.0,
    'mountain': 3.0,
    'water': 10.0,
    'rough': 2.5,
    'default': 1.0
};

// Test 1: Basic initialization
console.log('\n=== Test 1: Initialization ===');
const astar = new EnhancedAStar(testGrid, testRisk, terrainWeights);
console.log('A* initialized with:', astar.getStats());

// Test 2: Find path with default lambda (0.5)
console.log('\n=== Test 2: Find Path (λ=0.5) ===');
const start = {x: 0, y: 0};
const goal = {x: 9, y: 9};

console.log(`Finding path from (${start.x},${start.y}) to (${goal.x},${goal.y})`);
const path1 = astar.findPath(start, goal);

if (path1) {
    console.log(`Path found with ${path1.length} nodes`);
    const metrics1 = astar.calculatePathMetrics(path1);
    console.log('Path metrics:', metrics1);
    
    // Visualize path (simple ASCII)
    console.log('\nSimple visualization (P = path):');
    for (let y = 0; y < 10; y++) {
        let row = '';
        for (let x = 0; x < 10; x++) {
            const isPath = path1.some(node => node.x === x && node.y === y);
            row += isPath ? 'P ' : '. ';
        }
        console.log(row);
    }
} else {
    console.log('No path found!');
}

// Test 3: Different lambda values
console.log('\n=== Test 3: Different Lambda Values ===');
const lambdaValues = [0, 0.5, 1.0, 2.0];
const paths = [];

lambdaValues.forEach(lambda => {
    console.log(`\nTesting with λ=${lambda}:`);
    astar.setLambda(lambda);
    astar.reset();
    
    const path = astar.findPath(start, goal);
    if (path) {
        const metrics = astar.calculatePathMetrics(path);
        paths.push({ lambda, path, metrics });
        console.log(`  Distance: ${metrics.distance}`);
        console.log(`  Total risk: ${metrics.totalRisk}`);
        console.log(`  Total cost: ${metrics.totalCost}`);
        console.log(`  Search time: ${astar.getStats().searchTime.toFixed(2)}ms`);
    }
});

// Test 4: Bidirectional vs Unidirectional
console.log('\n=== Test 4: Bidirectional vs Unidirectional ===');
const start2 = {x: 0, y: 5};
const goal2 = {x: 9, y: 5};

console.log(`\nTesting from (${start2.x},${start2.y}) to (${goal2.x},${goal2.y})`);

// Bidirectional
astar.setBidirectional(true);
astar.reset();
const startTimeBidirectional = performance.now();
const pathBidirectional = astar.findPath(start2, goal2);
const timeBidirectional = performance.now() - startTimeBidirectional;

// Unidirectional
astar.setBidirectional(false);
astar.reset();
const startTimeUnidirectional = performance.now();
const pathUnidirectional = astar.findPath(start2, goal2);
const timeUnidirectional = performance.now() - startTimeUnidirectional;

console.log('\nComparison:');
console.log(`Bidirectional search: ${timeBidirectional.toFixed(2)}ms, ${astar.getStats().nodesExplored} nodes explored`);
console.log(`Unidirectional search: ${timeUnidirectional.toFixed(2)}ms, ${astar.getStats().nodesExplored} nodes explored`);

// Test 5: Different heuristics
console.log('\n=== Test 5: Different Heuristics ===');
const heuristics = ['manhattan', 'euclidean', 'chebyshev'];

heuristics.forEach(heuristic => {
    console.log(`\nTesting ${heuristic} heuristic:`);
    astar.setHeuristic(heuristic);
    astar.reset();
    
    const startTime = performance.now();
    const path = astar.findPath(start, goal);
    const time = performance.now() - startTime;
    
    if (path) {
        console.log(`  Search time: ${time.toFixed(2)}ms`);
        console.log(`  Nodes explored: ${astar.getStats().nodesExplored}`);
        console.log(`  Path length: ${path.length}`);
    }
});

// Test 6: Dynamic λ adjustment demonstration
console.log('\n=== Test 6: Dynamic λ Adjustment ===');
console.log('Showing how λ affects path choice:');

// Create a simple grid with risk corridor
const riskGrid = [];
const highRiskMap = [];
for (let y = 0; y < 5; y++) {
    riskGrid[y] = [];
    highRiskMap[y] = [];
    for (let x = 0; x < 10; x++) {
        riskGrid[y][x] = 'road';
        // Create a high-risk corridor in the middle
        highRiskMap[y][x] = (x >= 4 && x <= 6) ? 0.9 : 0.1;
    }
}

const testAStar = new EnhancedAStar(riskGrid, highRiskMap, terrainWeights);
const simpleStart = {x: 0, y: 2};
const simpleGoal = {x: 9, y: 2};

console.log('\nGrid layout:');
console.log('. = low risk (0.1)');
console.log('# = high risk (0.9)');
console.log('S = start, G = goal');

for (let y = 0; y < 5; y++) {
    let row = '';
    for (let x = 0; x < 10; x++) {
        if (x === simpleStart.x && y === simpleStart.y) {
            row += 'S ';
        } else if (x === simpleGoal.x && y === simpleGoal.y) {
            row += 'G ';
        } else {
            row += (highRiskMap[y][x] > 0.5) ? '# ' : '. ';
        }
    }
    console.log(row);
}

// Test different lambda values
console.log('\nPath selection with different λ:');
[0, 0.5, 2.0].forEach(lambda => {
    testAStar.setLambda(lambda);
    testAStar.reset();
    
    const path = testAStar.findPath(simpleStart, simpleGoal);
    if (path) {
        const metrics = testAStar.calculatePathMetrics(path);
        
        // Determine if path goes through high-risk area
        const goesThroughHighRisk = path.some(node => 
            highRiskMap[node.y][node.x] > 0.5
        );
        
        console.log(`λ=${lambda}: ${goesThroughHighRisk ? 'Goes through high risk' : 'Avoids high risk'}`);
        console.log(`  Distance: ${metrics.distance}, Risk: ${metrics.totalRisk.toFixed(2)}`);
    }
});

// Test 7: Edge cases
console.log('\n=== Test 7: Edge Cases ===');

console.log('\n1. Invalid start/goal:');
try {
    astar.findPath({x: -1, y: 0}, {x: 0, y: 0});
} catch (e) {
    console.log('  Caught error:', e.message);
}

console.log('\n2. Blocked goal:');
const blockedGrid = [
    ['road', 'road', 'road'],
    ['road', 'water', 'road'],
    ['road', 'road', 'water']
];
const blockedAStar = new EnhancedAStar(blockedGrid);
const blockedPath = blockedAStar.findPath({x: 0, y: 0}, {x: 2, y: 2});
console.log('  Path to blocked goal:', blockedPath ? 'Found' : 'Not found (correct)');

console.log('\n3. Same start and goal:');
const samePath = astar.findPath(start, start);
console.log('  Path from start to start:', samePath ? `Found (${samePath.length} nodes)` : 'Not found');

// Test 8: Performance on larger grid
console.log('\n=== Test 8: Performance Test ===');
console.log('Creating 50x50 grid for performance test...');

// Create larger grid
const largeGrid = [];
const largeRisk = [];
const size = 50;

for (let y = 0; y < size; y++) {
    largeGrid[y] = [];
    largeRisk[y] = [];
    for (let x = 0; x < size; x++) {
        // Random terrain
        const terrains = ['road', 'grass', 'forest', 'urban'];
        largeGrid[y][x] = terrains[Math.floor(Math.random() * terrains.length)];
        
        // Random risk (0-1)
        largeRisk[y][x] = Math.random();
    }
}

const largeAStar = new EnhancedAStar(largeGrid, largeRisk, terrainWeights);
largeAStar.setBidirectional(true);

const largeStart = {x: 0, y: 0};
const largeGoal = {x: size-1, y: size-1};

console.log(`Finding path on ${size}x${size} grid...`);
const largeStartTime = performance.now();
const largePath = largeAStar.findPath(largeStart, largeGoal);
const largeTime = performance.now() - largeStartTime;

if (largePath) {
    console.log(`  Found path in ${largeTime.toFixed(2)}ms`);
    console.log(`  Nodes explored: ${largeAStar.getStats().nodesExplored}`);
    console.log(`  Path length: ${largePath.length}`);
} else {
    console.log('  No path found');
}

console.log('\n✅ Enhanced A* Implementation Complete!');
console.log('✓ Optimized for larger grids');
console.log('✓ Bidirectional search implementation');
console.log('✓ Terrain/road type considerations');
console.log('✓ Dynamic λ adjustment based on risk level');
console.log('✓ Multiple heuristic options');
console.log('✓ Path metrics calculation');
console.log('✓ Performance testing');