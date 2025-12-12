// algorithms/routing/RouteGenerator.js
const EnhancedAStar = require('./EnhancedAStar');

class RouteGenerator {
    constructor(grid, riskMap = null, terrainWeights = null) {
        this.grid = grid;
        this.riskMap = riskMap || this._createDefaultRiskMap(grid);
        this.terrainWeights = terrainWeights || this._getDefaultTerrainWeights();
        
        // Route options configuration
        this.routeConfigs = [
            { type: 'shortest', lambda: 0.0, description: 'Minimize distance only' },
            { type: 'balanced', lambda: 0.5, description: 'Balance distance and risk' },
            { type: 'safest', lambda: 2.0, description: 'Minimize risk at any cost' }
        ];
        
        // Pareto frontier storage
        this.paretoFrontier = [];
        this.allRoutes = [];
        
        // Performance tracking
        this.generationTime = 0;
        
        console.log('Route Generator initialized');
        console.log('- Grid size:', `${grid.length}x${grid[0].length}`);
        console.log('- Route options:', this.routeConfigs.map(r => r.type).join(', '));
    }
    
    /**
     * Create default risk map (all zeros)
     * @private
     */
    _createDefaultRiskMap(grid) {
        const riskMap = [];
        for (let y = 0; y < grid.length; y++) {
            riskMap[y] = [];
            for (let x = 0; x < grid[y].length; x++) {
                riskMap[y][x] = 0;
            }
        }
        return riskMap;
    }
    
    /**
     * Get default terrain weights
     * @private
     */
    _getDefaultTerrainWeights() {
        return {
            'road': 1.0,
            'grass': 1.5,
            'forest': 2.0,
            'mountain': 3.0,
            'water': 10.0,
            'urban': 1.2,
            'rough': 2.5,
            'default': 1.0
        };
    }
    
    /**
     * Generate 3 alternative route options
     * @param {Object} start - {x, y} coordinates
     * @param {Object} goal - {x, y} coordinates
     * @returns {Array} Array of route objects
     */
    generateAlternativeRoutes(start, goal) {
        const startTime = performance.now();
        this.allRoutes = [];
        
        console.log(`\nGenerating alternative routes from (${start.x},${start.y}) to (${goal.x},${goal.y})`);
        
        // Generate routes for each configuration
        this.routeConfigs.forEach(config => {
            console.log(`\nGenerating ${config.type} path (λ=${config.lambda})...`);
            
            const astar = new EnhancedAStar(this.grid, this.riskMap, this.terrainWeights);
            astar.setLambda(config.lambda);
            
            const path = astar.findPath(start, goal);
            
            if (path) {
                const metrics = astar.calculatePathMetrics(path);
                const stats = astar.getStats();
                
                const route = {
                    type: config.type,
                    lambda: config.lambda,
                    description: config.description,
                    path: path,
                    metrics: metrics,
                    stats: stats,
                    id: `${config.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                };
                
                this.allRoutes.push(route);
                
                console.log(`  ✓ Found path with ${path.length} nodes`);
                console.log(`    Distance: ${metrics.distance}`);
                console.log(`    Total risk: ${metrics.totalRisk.toFixed(2)}`);
                console.log(`    Total cost: ${metrics.totalCost.toFixed(2)}`);
                console.log(`    Search time: ${stats.searchTime.toFixed(2)}ms`);
            } else {
                console.log(`  ✗ No path found for ${config.type}`);
            }
        });
        
        // Calculate Pareto frontier
        this.paretoFrontier = this._calculateParetoFrontier(this.allRoutes);
        
        this.generationTime = performance.now() - startTime;
        console.log(`\nRoute generation completed in ${this.generationTime.toFixed(2)}ms`);
        console.log(`Generated ${this.allRoutes.length} routes, ${this.paretoFrontier.length} Pareto-optimal`);
        
        return this.allRoutes;
    }
    
    /**
     * Calculate Pareto frontier (non-dominated solutions)
     * @private
     */
    _calculateParetoFrontier(routes) {
        if (routes.length === 0) return [];
        
        const frontier = [];
        
        for (let i = 0; i < routes.length; i++) {
            const routeA = routes[i];
            let dominated = false;
            
            for (let j = 0; j < routes.length; j++) {
                if (i === j) continue;
                
                const routeB = routes[j];
                
                // Check if routeB dominates routeA
                // routeB dominates routeA if:
                // 1. routeB is not worse in any objective
                // 2. routeB is strictly better in at least one objective
                const dominates = (
                    routeB.metrics.distance <= routeA.metrics.distance &&
                    routeB.metrics.totalRisk <= routeA.metrics.totalRisk &&
                    (routeB.metrics.distance < routeA.metrics.distance ||
                     routeB.metrics.totalRisk < routeA.metrics.totalRisk)
                );
                
                if (dominates) {
                    dominated = true;
                    break;
                }
            }
            
            if (!dominated) {
                frontier.push(routeA);
            }
        }
        
        // Sort frontier by distance (ascending)
        frontier.sort((a, b) => a.metrics.distance - b.metrics.distance);
        
        return frontier;
    }
    
    /**
     * Generate trade-off analysis between routes
     * @param {Array} routes - Routes to analyze (optional, uses generated routes if not provided)
     * @returns {Object} Trade-off analysis
     */
    generateTradeOffAnalysis(routes = null) {
        const routesToAnalyze = routes || this.allRoutes;
        
        if (routesToAnalyze.length < 2) {
            return {
                message: 'Need at least 2 routes for analysis',
                routes: routesToAnalyze.length
            };
        }
        
        const analysis = {
            timestamp: new Date().toISOString(),
            totalRoutes: routesToAnalyze.length,
            paretoOptimal: this.paretoFrontier.length,
            comparisons: {},
            recommendations: []
        };
        
        // Find reference routes
        const shortestRoute = routesToAnalyze.find(r => r.type === 'shortest');
        const balancedRoute = routesToAnalyze.find(r => r.type === 'balanced');
        const safestRoute = routesToAnalyze.find(r => r.type === 'safest');
        
        // Compare shortest vs balanced
        if (shortestRoute && balancedRoute) {
            const distIncrease = ((balancedRoute.metrics.distance - shortestRoute.metrics.distance) / 
                                shortestRoute.metrics.distance * 100);
            const riskReduction = shortestRoute.metrics.totalRisk > 0 ? 
                ((shortestRoute.metrics.totalRisk - balancedRoute.metrics.totalRisk) / 
                 shortestRoute.metrics.totalRisk * 100) : 0;
            
            analysis.comparisons.shortestVsBalanced = {
                distanceIncrease: `${distIncrease.toFixed(1)}%`,
                riskReduction: `${riskReduction.toFixed(1)}%`,
                tradeOffRatio: riskReduction / distIncrease
            };
            
            if (riskReduction > distIncrease * 2) {
                analysis.recommendations.push(
                    `Balanced route offers good risk reduction (${riskReduction.toFixed(1)}%) ` +
                    `for moderate distance increase (${distIncrease.toFixed(1)}%). Recommended.`
                );
            }
        }
        
        // Compare shortest vs safest
        if (shortestRoute && safestRoute) {
            const distIncrease = ((safestRoute.metrics.distance - shortestRoute.metrics.distance) / 
                                shortestRoute.metrics.distance * 100);
            const riskReduction = shortestRoute.metrics.totalRisk > 0 ? 
                ((shortestRoute.metrics.totalRisk - safestRoute.metrics.totalRisk) / 
                 shortestRoute.metrics.totalRisk * 100) : 0;
            
            analysis.comparisons.shortestVsSafest = {
                distanceIncrease: `${distIncrease.toFixed(1)}%`,
                riskReduction: `${riskReduction.toFixed(1)}%`,
                tradeOffRatio: riskReduction / distIncrease
            };
            
            if (riskReduction > 50 && distIncrease < 100) {
                analysis.recommendations.push(
                    `Safest route significantly reduces risk (${riskReduction.toFixed(1)}%) ` +
                    `with ${distIncrease.toFixed(1)}% longer distance. Consider for high-risk areas.`
                );
            }
        }
        
        // Compare balanced vs safest
        if (balancedRoute && safestRoute) {
            const distIncrease = ((safestRoute.metrics.distance - balancedRoute.metrics.distance) / 
                                balancedRoute.metrics.distance * 100);
            const riskReduction = balancedRoute.metrics.totalRisk > 0 ? 
                ((balancedRoute.metrics.totalRisk - safestRoute.metrics.totalRisk) / 
                 balancedRoute.metrics.totalRisk * 100) : 0;
            
            analysis.comparisons.balancedVsSafest = {
                distanceIncrease: `${distIncrease.toFixed(1)}%`,
                riskReduction: `${riskReduction.toFixed(1)}%`,
                tradeOffRatio: riskReduction / distIncrease
            };
        }
        
        // Calculate overall metrics
        const distances = routesToAnalyze.map(r => r.metrics.distance);
        const risks = routesToAnalyze.map(r => r.metrics.totalRisk);
        
        analysis.metrics = {
            minDistance: Math.min(...distances),
            maxDistance: Math.max(...distances),
            avgDistance: distances.reduce((a, b) => a + b, 0) / distances.length,
            minRisk: Math.min(...risks),
            maxRisk: Math.max(...risks),
            avgRisk: risks.reduce((a, b) => a + b, 0) / risks.length
        };
        
        // Determine Pareto-optimal routes
        analysis.paretoOptimalRoutes = this.paretoFrontier.map(r => ({
            type: r.type,
            distance: r.metrics.distance,
            risk: r.metrics.totalRisk,
            lambda: r.lambda
        }));
        
        // Generate visualization data for Pareto frontier
        analysis.paretoFrontierData = this.paretoFrontier.map(r => ({
            x: r.metrics.distance,
            y: r.metrics.totalRisk,
            type: r.type,
            label: `${r.type} (λ=${r.lambda})`
        }));
        
        // Add cost-effectiveness analysis
        analysis.costEffectiveness = routesToAnalyze.map(r => ({
            type: r.type,
            distance: r.metrics.distance,
            risk: r.metrics.totalRisk,
            costPerRiskReduction: r.metrics.distance / (r.metrics.totalRisk + 0.001), // Avoid division by zero
            efficiencyScore: 1 / (r.metrics.distance * (r.metrics.totalRisk + 1))
        }));
        
        // Sort by efficiency
        analysis.costEffectiveness.sort((a, b) => b.efficiencyScore - a.efficiencyScore);
        
        return analysis;
    }
    
    /**
     * Generate additional routes beyond the basic 3
     * @param {Object} start - Start coordinates
     * @param {Object} goal - Goal coordinates
     * @param {Array} lambdas - Additional lambda values to try
     * @returns {Array} Additional routes
     */
    generateAdditionalRoutes(start, goal, lambdas = [0.1, 0.2, 0.8, 1.0, 1.5]) {
        const additionalRoutes = [];
        
        console.log(`\nGenerating ${lambdas.length} additional routes with custom λ values...`);
        
        lambdas.forEach(lambda => {
            const astar = new EnhancedAStar(this.grid, this.riskMap, this.terrainWeights);
            astar.setLambda(lambda);
            
            const path = astar.findPath(start, goal);
            
            if (path) {
                const metrics = astar.calculatePathMetrics(path);
                
                const route = {
                    type: 'custom',
                    lambda: lambda,
                    description: `Custom route with λ=${lambda}`,
                    path: path,
                    metrics: metrics,
                    stats: astar.getStats(),
                    id: `custom_${lambda}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
                };
                
                additionalRoutes.push(route);
                this.allRoutes.push(route);
                
                console.log(`  λ=${lambda}: Distance ${metrics.distance.toFixed(1)}, Risk ${metrics.totalRisk.toFixed(2)}`);
            }
        });
        
        // Recalculate Pareto frontier with new routes
        this.paretoFrontier = this._calculateParetoFrontier(this.allRoutes);
        
        return additionalRoutes;
    }
    
    /**
     * Visualize routes on grid
     * @param {Array} routes - Routes to visualize
     * @param {Object} start - Start coordinates
     * @param {Object} goal - Goal coordinates
     * @returns {Object} Visualization data
     */
    visualizeRoutes(routes, start, goal) {
        const visualization = {
            grid: JSON.parse(JSON.stringify(this.grid)), // Deep copy
            start: start,
            goal: goal,
            routeOverlays: [],
            legend: {}
        };
        
        // Define symbols for different route types
        const routeSymbols = {
            'shortest': '1',
            'balanced': '2',
            'safest': '3',
            'custom': 'C'
        };
        
        // Create overlays for each route
        routes.forEach((route, index) => {
            const overlay = {
                routeType: route.type,
                lambda: route.lambda,
                symbol: routeSymbols[route.type] || 'X',
                path: route.path,
                cells: []
            };
            
            // Mark path cells (skip start and goal)
            route.path.forEach((node, nodeIndex) => {
                if ((node.x !== start.x || node.y !== start.y) &&
                    (node.x !== goal.x || node.y !== goal.y)) {
                    overlay.cells.push({
                        x: node.x,
                        y: node.y,
                        symbol: overlay.symbol
                    });
                }
            });
            
            visualization.routeOverlays.push(overlay);
        });
        
        // Create legend
        visualization.legend = {
            'S': 'Start',
            'G': 'Goal'
        };
        
        routes.forEach(route => {
            const symbol = routeSymbols[route.type] || 'X';
            visualization.legend[symbol] = `${route.type} (λ=${route.lambda})`;
        });
        
        // Add terrain legend
        const terrainTypes = new Set();
        this.grid.forEach(row => row.forEach(cell => terrainTypes.add(cell)));
        visualization.terrainLegend = {};
        Array.from(terrainTypes).forEach(terrain => {
            visualization.terrainLegend[terrain] = terrain;
        });
        
        return visualization;
    }
    
    /**
     * Generate ASCII visualization of routes
     * @param {Array} routes - Routes to visualize
     * @param {Object} start - Start coordinates
     * @param {Object} goal - Goal coordinates
     * @param {number} width - Maximum width for display
     * @returns {string} ASCII visualization
     */
    generateAsciiVisualization(routes, start, goal, width = 80) {
        if (!routes || routes.length === 0) {
            return 'No routes to visualize';
        }
        
        // Get grid bounds
        const allNodes = routes.flatMap(r => r.path);
        const xs = allNodes.map(n => n.x);
        const ys = allNodes.map(n => n.y);
        const minX = Math.min(start.x, goal.x, ...xs);
        const maxX = Math.max(start.x, goal.x, ...xs);
        const minY = Math.min(start.y, goal.y, ...ys);
        const maxY = Math.max(start.y, goal.y, ...ys);
        
        // Add padding
        const pad = 2;
        const visWidth = maxX - minX + 1 + pad * 2;
        const visHeight = maxY - minY + 1 + pad * 2;
        
        // Create empty visualization grid
        const visGrid = Array(visHeight).fill().map(() => Array(visWidth).fill('.'));
        
        // Mark terrain (simplified - just show if it's not road)
        for (let y = minY - pad; y <= maxY + pad; y++) {
            for (let x = minX - pad; x <= maxX + pad; x++) {
                if (y >= 0 && y < this.grid.length && x >= 0 && x < this.grid[0].length) {
                    const visY = y - minY + pad;
                    const visX = x - minX + pad;
                    
                    if (this.grid[y][x] !== 'road') {
                        const terrainChar = this.grid[y][x].charAt(0).toUpperCase();
                        visGrid[visY][visX] = terrainChar;
                    }
                    
                    // Mark high risk areas
                    if (this.riskMap[y][x] > 0.7) {
                        visGrid[visY][visX] = '▓'; // High risk
                    } else if (this.riskMap[y][x] > 0.3) {
                        visGrid[visY][visX] = '▒'; // Medium risk
                    }
                }
            }
        }
        
        // Mark routes with different numbers
        const routeChars = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        
        routes.forEach((route, routeIndex) => {
            const routeChar = routeIndex < routeChars.length ? routeChars[routeIndex] : 'X';
            
            route.path.forEach(node => {
                const visY = node.y - minY + pad;
                const visX = node.x - minX + pad;
                
                // Only mark if not start/goal and within bounds
                if ((node.x !== start.x || node.y !== start.y) &&
                    (node.x !== goal.x || node.y !== goal.y) &&
                    visY >= 0 && visY < visHeight && visX >= 0 && visX < visWidth) {
                    
                    // If multiple routes go through same cell, mark with '*'
                    if (visGrid[visY][visX] !== '.' && 
                        visGrid[visY][visX] !== 'S' && 
                        visGrid[visY][visX] !== 'G') {
                        visGrid[visY][visX] = '*';
                    } else {
                        visGrid[visY][visX] = routeChar;
                    }
                }
            });
        });
        
        // Mark start and goal
        const startY = start.y - minY + pad;
        const startX = start.x - minX + pad;
        const goalY = goal.y - minY + pad;
        const goalX = goal.x - minX + pad;
        
        if (startY >= 0 && startY < visHeight && startX >= 0 && startX < visWidth) {
            visGrid[startY][startX] = 'S';
        }
        if (goalY >= 0 && goalY < visHeight && goalX >= 0 && goalX < visWidth) {
            visGrid[goalY][goalX] = 'G';
        }
        
        // Build ASCII string
        let ascii = '\n';
        ascii += 'Route Visualization:\n';
        ascii += '====================\n';
        
        for (let y = 0; y < visHeight; y++) {
            let row = '';
            for (let x = 0; x < visWidth; x++) {
                row += visGrid[y][x] + ' ';
            }
            ascii += row + '\n';
        }
        
        // Add legend
        ascii += '\nLegend:\n';
        ascii += '  S = Start\n';
        ascii += '  G = Goal\n';
        ascii += '  . = Road (low risk)\n';
        ascii += '  ▒ = Medium risk area\n';
        ascii += '  ▓ = High risk area\n';
        
        routes.forEach((route, index) => {
            if (index < routeChars.length) {
                ascii += `  ${routeChars[index]} = ${route.type} route (λ=${route.lambda})\n`;
            }
        });
        
        ascii += '  * = Multiple routes overlap\n';
        
        // Add terrain legend
        const terrainChars = new Set();
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                if (y >= 0 && y < this.grid.length && x >= 0 && x < this.grid[0].length) {
                    if (this.grid[y][x] !== 'road') {
                        const char = this.grid[y][x].charAt(0).toUpperCase();
                        terrainChars.add(`${char} = ${this.grid[y][x]}`);
                    }
                }
            }
        }
        
        if (terrainChars.size > 0) {
            ascii += '\nTerrain:\n';
            Array.from(terrainChars).forEach(item => {
                ascii += `  ${item}\n`;
            });
        }
        
        return ascii;
    }
    
    /**
     * Get all generated routes
     * @returns {Array} All routes
     */
    getRoutes() {
        return this.allRoutes;
    }
    
    /**
     * Get Pareto frontier
     * @returns {Array} Pareto-optimal routes
     */
    getParetoFrontier() {
        return this.paretoFrontier;
    }
    
    /**
     * Get generation statistics
     * @returns {Object} Generation statistics
     */
    getStats() {
        return {
            generationTime: this.generationTime,
            totalRoutes: this.allRoutes.length,
            paretoOptimal: this.paretoFrontier.length,
            routeConfigs: this.routeConfigs
        };
    }
    
    /**
     * Reset generator
     */
    reset() {
        this.allRoutes = [];
        this.paretoFrontier = [];
        this.generationTime = 0;
        return this;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RouteGenerator;
}