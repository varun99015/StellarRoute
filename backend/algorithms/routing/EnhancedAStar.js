// algorithms/routing/EnhancedAStar.js
const PriorityQueue = require('./PriorityQueue');

class EnhancedAStar {
    constructor(grid, riskMap = null, terrainWeights = null) {
        this.grid = grid; // 2D array representing the map
        this.riskMap = riskMap || this._createDefaultRiskMap(grid);
        this.terrainWeights = terrainWeights || this._getDefaultTerrainWeights();
        
        // Risk penalty parameter (λ)
        this.lambda = 0.5; // Default balanced
        
        // Search configuration
        this.useBidirectional = true;
        this.heuristicType = 'manhattan'; // 'manhattan', 'euclidean', 'chebyshev'
        
        // Performance tracking
        this.nodesExplored = 0;
        this.searchTime = 0;
        this.pathLength = 0;
        
        console.log('Enhanced A* initialized');
        console.log('- Grid size:', `${grid.length}x${grid[0].length}`);
        console.log('- Lambda (risk weight):', this.lambda);
        console.log('- Bidirectional search:', this.useBidirectional);
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
     * Set lambda (risk penalty parameter)
     * @param {number} lambda - Risk penalty multiplier
     */
    setLambda(lambda) {
        if (lambda < 0) {
            throw new Error('Lambda must be non-negative');
        }
        this.lambda = lambda;
        console.log(`Lambda set to: ${lambda}`);
        return this;
    }
    
    /**
     * Enable/disable bidirectional search
     * @param {boolean} enabled - Whether to use bidirectional search
     */
    setBidirectional(enabled) {
        this.useBidirectional = enabled;
        console.log(`Bidirectional search: ${enabled ? 'enabled' : 'disabled'}`);
        return this;
    }
    
    /**
     * Set heuristic type
     * @param {string} type - 'manhattan', 'euclidean', or 'chebyshev'
     */
    setHeuristic(type) {
        const validTypes = ['manhattan', 'euclidean', 'chebyshev'];
        if (!validTypes.includes(type)) {
            throw new Error(`Heuristic must be one of: ${validTypes.join(', ')}`);
        }
        this.heuristicType = type;
        console.log(`Heuristic type set to: ${type}`);
        return this;
    }
    
    /**
     * Find path from start to goal
     * @param {Object} start - {x, y} coordinates
     * @param {Object} goal - {x, y} coordinates
     * @returns {Array|null} Path as array of nodes, or null if no path
     */
    findPath(start, goal) {
        const startTime = performance.now();
        this.nodesExplored = 0;
        
        // Validate inputs
        if (!this._isValidNode(start) || !this._isValidNode(goal)) {
            throw new Error('Start or goal coordinates are invalid');
        }
        
        if (this._isBlocked(goal)) {
            console.warn('Goal node is blocked');
            return null;
        }
        
        console.log(`Finding path from (${start.x},${start.y}) to (${goal.x},${goal.y})`);
        
        let path;
        if (this.useBidirectional) {
            path = this._bidirectionalSearch(start, goal);
        } else {
            path = this._unidirectionalSearch(start, goal);
        }
        
        this.searchTime = performance.now() - startTime;
        this.pathLength = path ? path.length : 0;
        
        console.log(`Search completed in ${this.searchTime.toFixed(2)}ms`);
        console.log(`Nodes explored: ${this.nodesExplored}`);
        console.log(`Path length: ${this.pathLength}`);
        
        return path;
    }
    
    /**
     * Standard A* search (unidirectional)
     * @private
     */
    _unidirectionalSearch(start, goal) {
        // Data structures
        const openSet = new PriorityQueue();
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        
        // Initialize
        const startKey = this._nodeKey(start);
        const goalKey = this._nodeKey(goal);
        
        gScore.set(startKey, 0);
        fScore.set(startKey, this._heuristic(start, goal));
        openSet.enqueue(start, fScore.get(startKey));
        
        while (!openSet.isEmpty()) {
            const current = openSet.dequeue();
            const currentKey = this._nodeKey(current);
            
            this.nodesExplored++;
            
            // Check if we reached the goal
            if (currentKey === goalKey) {
                return this._reconstructPath(cameFrom, current);
            }
            
            closedSet.add(currentKey);
            
            // Explore neighbors
            for (const neighbor of this._getNeighbors(current)) {
                const neighborKey = this._nodeKey(neighbor);
                
                // Skip if blocked or already closed
                if (this._isBlocked(neighbor) || closedSet.has(neighborKey)) {
                    continue;
                }
                
                // Calculate tentative gScore
                const tentativeGScore = gScore.get(currentKey) + 
                    this._getCost(current, neighbor);
                
                // Check if this is a better path to neighbor
                if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
                    // This path is better, record it
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeGScore);
                    
                    const newFScore = tentativeGScore + this._heuristic(neighbor, goal);
                    fScore.set(neighborKey, newFScore);
                    
                    if (!openSet.contains(neighbor)) {
                        openSet.enqueue(neighbor, newFScore);
                    } else {
                        openSet.updatePriority(neighbor, newFScore);
                    }
                }
            }
        }
        
        // No path found
        return null;
    }
    
    /**
     * Bidirectional A* search
     * @private
     */
    _bidirectionalSearch(start, goal) {
        // Forward search data structures
        const openSetForward = new PriorityQueue();
        const closedSetForward = new Set();
        const cameFromForward = new Map();
        const gScoreForward = new Map();
        
        // Backward search data structures
        const openSetBackward = new PriorityQueue();
        const closedSetBackward = new Set();
        const cameFromBackward = new Map();
        const gScoreBackward = new Map();
        
        // Initialize forward search
        const startKey = this._nodeKey(start);
        gScoreForward.set(startKey, 0);
        openSetForward.enqueue(start, this._heuristic(start, goal));
        
        // Initialize backward search
        const goalKey = this._nodeKey(goal);
        gScoreBackward.set(goalKey, 0);
        openSetBackward.enqueue(goal, this._heuristic(goal, start));
        
        let meetingNode = null;
        let meetingGScore = Infinity;
        
        while (!openSetForward.isEmpty() && !openSetBackward.isEmpty()) {
            // Expand forward search
            if (!openSetForward.isEmpty()) {
                const currentForward = openSetForward.dequeue();
                const currentForwardKey = this._nodeKey(currentForward);
                
                this.nodesExplored++;
                closedSetForward.add(currentForwardKey);
                
                // Check if backward search has visited this node
                if (closedSetBackward.has(currentForwardKey)) {
                    const totalGScore = gScoreForward.get(currentForwardKey) + 
                                      gScoreBackward.get(currentForwardKey);
                    
                    if (totalGScore < meetingGScore) {
                        meetingNode = currentForward;
                        meetingGScore = totalGScore;
                    }
                }
                
                // Expand forward neighbors
                for (const neighbor of this._getNeighbors(currentForward)) {
                    const neighborKey = this._nodeKey(neighbor);
                    
                    if (this._isBlocked(neighbor) || closedSetForward.has(neighborKey)) {
                        continue;
                    }
                    
                    const tentativeGScore = gScoreForward.get(currentForwardKey) + 
                        this._getCost(currentForward, neighbor);
                    
                    if (tentativeGScore < (gScoreForward.get(neighborKey) || Infinity)) {
                        cameFromForward.set(neighborKey, currentForward);
                        gScoreForward.set(neighborKey, tentativeGScore);
                        
                        const fScore = tentativeGScore + this._heuristic(neighbor, goal);
                        
                        if (!openSetForward.contains(neighbor)) {
                            openSetForward.enqueue(neighbor, fScore);
                        } else {
                            openSetForward.updatePriority(neighbor, fScore);
                        }
                    }
                }
            }
            
            // Expand backward search
            if (!openSetBackward.isEmpty()) {
                const currentBackward = openSetBackward.dequeue();
                const currentBackwardKey = this._nodeKey(currentBackward);
                
                this.nodesExplored++;
                closedSetBackward.add(currentBackwardKey);
                
                // Check if forward search has visited this node
                if (closedSetForward.has(currentBackwardKey)) {
                    const totalGScore = gScoreForward.get(currentBackwardKey) + 
                                      gScoreBackward.get(currentBackwardKey);
                    
                    if (totalGScore < meetingGScore) {
                        meetingNode = currentBackward;
                        meetingGScore = totalGScore;
                    }
                }
                
                // Expand backward neighbors
                for (const neighbor of this._getNeighbors(currentBackward)) {
                    const neighborKey = this._nodeKey(neighbor);
                    
                    if (this._isBlocked(neighbor) || closedSetBackward.has(neighborKey)) {
                        continue;
                    }
                    
                    const tentativeGScore = gScoreBackward.get(currentBackwardKey) + 
                        this._getCost(currentBackward, neighbor);
                    
                    if (tentativeGScore < (gScoreBackward.get(neighborKey) || Infinity)) {
                        cameFromBackward.set(neighborKey, currentBackward);
                        gScoreBackward.set(neighborKey, tentativeGScore);
                        
                        const fScore = tentativeGScore + this._heuristic(neighbor, start);
                        
                        if (!openSetBackward.contains(neighbor)) {
                            openSetBackward.enqueue(neighbor, fScore);
                        } else {
                            openSetBackward.updatePriority(neighbor, fScore);
                        }
                    }
                }
            }
            
            // Check if we found a meeting point
            if (meetingNode !== null) {
                // Check if we can't improve further
                const bestPossibleForward = openSetForward.isEmpty() ? 
                    Infinity : openSetForward.heap[0].priority;
                const bestPossibleBackward = openSetBackward.isEmpty() ? 
                    Infinity : openSetBackward.heap[0].priority;
                
                if (meetingGScore <= bestPossibleForward + bestPossibleBackward) {
                    // Reconstruct path from meeting point
                    const forwardPath = this._reconstructPath(cameFromForward, meetingNode);
                    const backwardPath = this._reconstructPath(cameFromBackward, meetingNode);
                    
                    // Combine paths (excluding meeting node from one)
                    backwardPath.reverse();
                    return forwardPath.concat(backwardPath.slice(1));
                }
            }
        }
        
        // Try unidirectional search as fallback
        console.log('Bidirectional search failed, falling back to unidirectional');
        return this._unidirectionalSearch(start, goal);
    }
    
    /**
     * Get movement cost between two nodes
     * @private
     */
    _getCost(from, to) {
        const baseCost = 1.0;
        
        // Get terrain type at destination
        const terrainType = this.grid[to.y][to.x];
        const terrainWeight = this.terrainWeights[terrainType] || this.terrainWeights.default;
        
        // Get risk at destination
        const risk = this.riskMap[to.y][to.x] || 0;
        
        // Calculate total cost: terrain cost + risk penalty
        // Dynamic λ adjustment based on risk level
        let effectiveLambda = this.lambda;
        if (risk > 0.7) {
            effectiveLambda *= 1.5; // Increase penalty for high risk
        }
        
        return baseCost * terrainWeight + risk * effectiveLambda;
    }
    
    /**
     * Calculate heuristic distance
     * @private
     */
    _heuristic(a, b) {
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        
        switch (this.heuristicType) {
            case 'manhattan':
                return dx + dy;
            case 'euclidean':
                return Math.sqrt(dx * dx + dy * dy);
            case 'chebyshev':
                return Math.max(dx, dy);
            default:
                return dx + dy;
        }
    }
    
    /**
     * Get valid neighbors for a node (8-directional)
     * @private
     */
    _getNeighbors(node) {
        const neighbors = [];
        const directions = [
            // Cardinal directions
            {x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1},
            // Diagonal directions (optional, can be removed for 4-directional)
            {x: 1, y: 1}, {x: 1, y: -1}, {x: -1, y: 1}, {x: -1, y: -1}
        ];
        
        for (const dir of directions) {
            const neighbor = {
                x: node.x + dir.x,
                y: node.y + dir.y
            };
            
            if (this._isValidNode(neighbor)) {
                // For diagonal moves, check if cardinal neighbors are blocked
                if (dir.x !== 0 && dir.y !== 0) {
                    const horizontal = {x: node.x + dir.x, y: node.y};
                    const vertical = {x: node.x, y: node.y + dir.y};
                    
                    if (this._isBlocked(horizontal) || this._isBlocked(vertical)) {
                        continue; // Don't cut corners
                    }
                }
                
                neighbors.push(neighbor);
            }
        }
        
        return neighbors;
    }
    
    /**
     * Check if node is valid (within grid bounds)
     * @private
     */
    _isValidNode(node) {
        return (
            node.x >= 0 && 
            node.x < this.grid[0].length && 
            node.y >= 0 && 
            node.y < this.grid.length
        );
    }
    
    /**
     * Check if node is blocked
     * @private
     */
    _isBlocked(node) {
        if (!this._isValidNode(node)) return true;
        
        const terrainType = this.grid[node.y][node.x];
        return terrainType === 'water' || terrainType === 'blocked';
    }
    
    /**
     * Create unique key for node
     * @private
     */
    _nodeKey(node) {
        return `${node.x},${node.y}`;
    }
    
    /**
     * Reconstruct path from cameFrom map
     * @private
     */
    _reconstructPath(cameFrom, current) {
        const totalPath = [current];
        
        while (cameFrom.has(this._nodeKey(current))) {
            current = cameFrom.get(this._nodeKey(current));
            totalPath.unshift(current);
        }
        
        return totalPath;
    }
    
    /**
     * Get search statistics
     * @returns {Object} Search performance statistics
     */
    getStats() {
        return {
            searchTime: this.searchTime,
            nodesExplored: this.nodesExplored,
            pathLength: this.pathLength,
            lambda: this.lambda,
            bidirectional: this.useBidirectional,
            heuristic: this.heuristicType
        };
    }
    
    /**
     * Calculate path metrics (distance, risk, terrain cost)
     * @param {Array} path - Path to analyze
     * @returns {Object} Path metrics
     */
    calculatePathMetrics(path) {
        if (!path || path.length < 2) {
            return {
                distance: 0,
                totalRisk: 0,
                avgRisk: 0,
                terrainCost: 0,
                totalCost: 0
            };
        }
        
        let distance = 0;
        let totalRisk = 0;
        let terrainCost = 0;
        
        for (let i = 1; i < path.length; i++) {
            const from = path[i-1];
            const to = path[i];
            
            // Calculate Euclidean distance
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            distance += Math.sqrt(dx*dx + dy*dy);
            
            // Add risk at destination
            totalRisk += this.riskMap[to.y][to.x] || 0;
            
            // Add terrain cost
            const terrainType = this.grid[to.y][to.x];
            const weight = this.terrainWeights[terrainType] || this.terrainWeights.default;
            terrainCost += weight;
        }
        
        const avgRisk = totalRisk / (path.length - 1);
        const totalCost = distance + totalRisk * this.lambda;
        
        return {
            distance: parseFloat(distance.toFixed(2)),
            totalRisk: parseFloat(totalRisk.toFixed(2)),
            avgRisk: parseFloat(avgRisk.toFixed(3)),
            terrainCost: parseFloat(terrainCost.toFixed(2)),
            totalCost: parseFloat(totalCost.toFixed(2))
        };
    }
    
    /**
     * Reset algorithm state
     */
    reset() {
        this.nodesExplored = 0;
        this.searchTime = 0;
        this.pathLength = 0;
        return this;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedAStar;
}