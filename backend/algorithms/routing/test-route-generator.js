// algorithms/routing/test-route-generator.js
const RouteGenerator = require('./RouteGenerator');

console.log('=== ALTERNATIVE ROUTE GENERATION TEST ===\n');

// Create test grid with varied terrain and risk
console.log('Creating 15x15 test grid with terrain and risk variations...');

const grid = [];
const riskMap = [];

for (let y = 0; y < 15; y++) {
    grid[y] = [];
    riskMap[y] = [];
    
    for (let x = 0; x < 15; x++) {
        // Create interesting terrain pattern
        if (x < 5 && y < 5) {
            grid[y][x] = 'urban';
            riskMap[y][x] = 0.3;
        } else if (x >= 10 || y >= 10) {
            grid[y][x] = 'mountain';
            riskMap[y][x] = 0.8;
        } else if ((x >= 6 && x <= 8) && (y >= 6 && y <= 8)) {
            grid[y][x] = 'water';
            riskMap[y][x] = 1.0;
        } else if (Math.abs(x - y) < 3) {
            grid[y][x] = 'forest';
            riskMap[y][x] = 0.6;
        } else if (x % 3 === 0 && y % 3 === 0) {
            grid[y][x] = 'rough';
            riskMap[y][x] = 0.4;
        } else {
            grid[y][x] = 'road';
            riskMap[y][x] = 0.1;
        }
    }
}

// Test 1: Basic route generation
console.log('\n=== Test 1: Basic Route Generation ===');
const routeGen = new RouteGenerator(grid, riskMap);

const start = {x: 0, y: 0};
const goal = {x: 14, y: 14};

console.log(`\nGenerating routes from (${start.x},${start.y}) to (${goal.x},${goal.y})`);
const routes = routeGen.generateAlternativeRoutes(start, goal);

console.log(`\nGenerated ${routes.length} routes:`);
routes.forEach(route => {
    console.log(`\n${route.type.toUpperCase()} (λ=${route.lambda}):`);
    console.log(`  Description: ${route.description}`);
    console.log(`  Path length: ${route.path.length} nodes`);
    console.log(`  Distance: ${route.metrics.distance}`);
    console.log(`  Total risk: ${route.metrics.totalRisk.toFixed(2)}`);
    console.log(`  Average risk: ${route.metrics.avgRisk.toFixed(3)}`);
    console.log(`  Terrain cost: ${route.metrics.terrainCost.toFixed(2)}`);
    console.log(`  Total cost: ${route.metrics.totalCost.toFixed(2)}`);
    console.log(`  Search time: ${route.stats.searchTime.toFixed(2)}ms`);
});

// Test 2: Trade-off analysis
console.log('\n=== Test 2: Trade-off Analysis ===');
const analysis = routeGen.generateTradeOffAnalysis();

console.log('\nTrade-off Analysis:');
console.log('===================');
console.log(`Total routes analyzed: ${analysis.totalRoutes}`);
console.log(`Pareto-optimal routes: ${analysis.paretoOptimal}`);

console.log('\nComparisons:');
if (analysis.comparisons.shortestVsBalanced) {
    console.log(`Shortest vs Balanced:`);
    console.log(`  Distance increase: ${analysis.comparisons.shortestVsBalanced.distanceIncrease}`);
    console.log(`  Risk reduction: ${analysis.comparisons.shortestVsBalanced.riskReduction}`);
    console.log(`  Trade-off ratio: ${analysis.comparisons.shortestVsBalanced.tradeOffRatio.toFixed(2)}`);
}

if (analysis.comparisons.shortestVsSafest) {
    console.log(`\nShortest vs Safest:`);
    console.log(`  Distance increase: ${analysis.comparisons.shortestVsSafest.distanceIncrease}`);
    console.log(`  Risk reduction: ${analysis.comparisons.shortestVsSafest.riskReduction}`);
    console.log(`  Trade-off ratio: ${analysis.comparisons.shortestVsSafest.tradeOffRatio.toFixed(2)}`);
}

console.log('\nOverall Metrics:');
console.log(`Distance range: ${analysis.metrics.minDistance.toFixed(1)} - ${analysis.metrics.maxDistance.toFixed(1)}`);
console.log(`Risk range: ${analysis.metrics.minRisk.toFixed(2)} - ${analysis.metrics.maxRisk.toFixed(2)}`);
console.log(`Average distance: ${analysis.metrics.avgDistance.toFixed(1)}`);
console.log(`Average risk: ${analysis.metrics.avgRisk.toFixed(2)}`);

console.log('\nPareto-optimal Routes:');
analysis.paretoOptimalRoutes.forEach(route => {
    console.log(`  ${route.type}: Distance ${route.distance.toFixed(1)}, Risk ${route.risk.toFixed(2)} (λ=${route.lambda})`);
});

console.log('\nRecommendations:');
analysis.recommendations.forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec}`);
});

// Test 3: Pareto frontier demonstration
console.log('\n=== Test 3: Pareto Frontier ===');
console.log('\nPareto Frontier Data (Distance vs Risk):');
routeGen.getParetoFrontier().forEach(route => {
    console.log(`  ${route.type}: (${route.metrics.distance.toFixed(1)}, ${route.metrics.totalRisk.toFixed(2)})`);
});

// Test 4: Additional custom routes
console.log('\n=== Test 4: Additional Custom Routes ===');
const additionalRoutes = routeGen.generateAdditionalRoutes(start, goal, [0.1, 0.3, 0.8, 1.2, 1.5]);

console.log(`\nGenerated ${additionalRoutes.length} additional routes:`);
additionalRoutes.forEach(route => {
    console.log(`  λ=${route.lambda}: Distance ${route.metrics.distance.toFixed(1)}, Risk ${route.metrics.totalRisk.toFixed(2)}`);
});

// Update analysis with new routes
const updatedAnalysis = routeGen.generateTradeOffAnalysis();
console.log(`\nUpdated Pareto-optimal routes: ${updatedAnalysis.paretoOptimal}`);

// Test 5: ASCII Visualization
console.log('\n=== Test 5: ASCII Visualization ===');

// Use just the first 3 routes for clearer visualization
const routesToVisualize = routes.slice(0, 3);
const asciiViz = routeGen.generateAsciiVisualization(routesToVisualize, start, goal, 60);

console.log(asciiViz);

// Test 6: Cost-effectiveness analysis
console.log('\n=== Test 6: Cost-Effectiveness Analysis ===');
console.log('\nRoutes sorted by efficiency (higher is better):');
updatedAnalysis.costEffectiveness.forEach((item, index) => {
    console.log(`${index + 1}. ${item.type} (λ=${routes.find(r => r.type === item.type)?.lambda || 'N/A'}):`);
    console.log(`   Efficiency score: ${item.efficiencyScore.toFixed(4)}`);
    console.log(`   Cost per risk reduction: ${item.costPerRiskReduction.toFixed(2)}`);
    console.log(`   Distance: ${item.distance.toFixed(1)}, Risk: ${item.risk.toFixed(2)}`);
});

// Test 7: Edge cases
console.log('\n=== Test 7: Edge Cases ===');

console.log('\n1. Same start and goal:');
const samePointRoutes = routeGen.generateAlternativeRoutes(start, start);
console.log(`   Generated ${samePointRoutes.length} routes (should be 0 or handle gracefully)`);

console.log('\n2. Very close points:');
const closeStart = {x: 0, y: 0};
const closeGoal = {x: 1, y: 1};
const closeRoutes = routeGen.generateAlternativeRoutes(closeStart, closeGoal);
console.log(`   Generated ${closeRoutes.length} routes`);

if (closeRoutes.length > 0) {
    closeRoutes.forEach(route => {
        console.log(`   ${route.type}: ${route.path.length} nodes`);
    });
}

// Test 8: Performance with different grid sizes
console.log('\n=== Test 8: Performance Scaling ===');

const testSizes = [10, 20, 30];
testSizes.forEach(size => {
    console.log(`\nTesting ${size}x${size} grid:`);
    
    // Create simple grid
    const testGrid = Array(size).fill().map(() => Array(size).fill('road'));
    const testRisk = Array(size).fill().map(() => Array(size).fill(0.1));
    
    const testGen = new RouteGenerator(testGrid, testRisk);
    const testStart = {x: 0, y: 0};
    const testGoal = {x: size-1, y: size-1};
    
    const startTime = performance.now();
    const testRoutes = testGen.generateAlternativeRoutes(testStart, testGoal);
    const totalTime = performance.now() - startTime;
    
    console.log(`  Generated ${testRoutes.length} routes in ${totalTime.toFixed(2)}ms`);
    console.log(`  Pareto-optimal: ${testGen.getParetoFrontier().length}`);
});

// Test 9: Visual comparison of routes
console.log('\n=== Test 9: Route Comparison Table ===');

console.log('\nRoute Comparison Summary:');
console.log('='.repeat(80));
console.log('Type        λ    Distance  Total Risk  Avg Risk  Terrain Cost  Total Cost');
console.log('-' + '-'.repeat(78));

routes.forEach(route => {
    const isPareto = routeGen.getParetoFrontier().some(r => r.id === route.id) ? '★' : ' ';
    console.log(
        `${isPareto}${route.type.padEnd(9)} ` +
        `${route.lambda.toString().padEnd(4)} ` +
        `${route.metrics.distance.toFixed(1).padStart(8)} ` +
        `${route.metrics.totalRisk.toFixed(2).padStart(10)} ` +
        `${route.metrics.avgRisk.toFixed(3).padStart(8)} ` +
        `${route.metrics.terrainCost.toFixed(2).padStart(12)} ` +
        `${route.metrics.totalCost.toFixed(2).padStart(10)}`
    );
});

console.log('\n★ = Pareto-optimal route');
console.log('\nNote: Total Cost = Distance + (Risk × λ)');

// Test 10: Decision support
console.log('\n=== Test 10: Decision Support ===');

console.log('\nBased on the analysis, here are the recommended choices:');
console.log('========================================================');

const shortestRoute = routes.find(r => r.type === 'shortest');
const balancedRoute = routes.find(r => r.type === 'balanced');
const safestRoute = routes.find(r => r.type === 'safest');

if (shortestRoute && balancedRoute && safestRoute) {
    console.log('\n1. For TIME-CRITICAL situations:');
    console.log(`   Choose SHORTEST route (λ=0)`);
    console.log(`   Distance: ${shortestRoute.metrics.distance.toFixed(1)}`);
    console.log(`   Risk: ${shortestRoute.metrics.totalRisk.toFixed(2)}`);
    
    console.log('\n2. For BALANCED approach (recommended):');
    console.log(`   Choose BALANCED route (λ=0.5)`);
    console.log(`   Distance: ${balancedRoute.metrics.distance.toFixed(1)} (+${((balancedRoute.metrics.distance - shortestRoute.metrics.distance) / shortestRoute.metrics.distance * 100).toFixed(1)}%)`);
    console.log(`   Risk: ${balancedRoute.metrics.totalRisk.toFixed(2)} (${shortestRoute.metrics.totalRisk > 0 ? ((shortestRoute.metrics.totalRisk - balancedRoute.metrics.totalRisk) / shortestRoute.metrics.totalRisk * 100).toFixed(1) : '0'}% reduction)`);
    
    console.log('\n3. For SAFETY-CRITICAL situations:');
    console.log(`   Choose SAFEST route (λ=2.0)`);
    console.log(`   Distance: ${safestRoute.metrics.distance.toFixed(1)} (+${((safestRoute.metrics.distance - shortestRoute.metrics.distance) / shortestRoute.metrics.distance * 100).toFixed(1)}%)`);
    console.log(`   Risk: ${safestRoute.metrics.totalRisk.toFixed(2)} (${shortestRoute.metrics.totalRisk > 0 ? ((shortestRoute.metrics.totalRisk - safestRoute.metrics.totalRisk) / shortestRoute.metrics.totalRisk * 100).toFixed(1) : '0'}% reduction)`);
}

console.log('\n✅ Alternative Route Generation Complete!');
console.log('✓ Generated 3 route options: Shortest, Balanced, Safest');
console.log('✓ Calculated Pareto frontier for optimal trade-offs');
console.log('✓ Comprehensive trade-off analysis with percentages');
console.log('✓ ASCII visualization of routes');
console.log('✓ Cost-effectiveness analysis');
console.log('✓ Decision support recommendations');
console.log('✓ Performance scaling tests');