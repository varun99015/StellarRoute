// algorithms/routing/PriorityQueue.js
class PriorityQueue {
    constructor() {
        this.heap = [];
        this.nodeMap = new Map(); // For quick lookup
    }
    
    /**
     * Enqueue a node with priority
     * @param {Object} node - The node to add
     * @param {number} priority - Lower number = higher priority
     */
    enqueue(node, priority) {
        const element = { node, priority };
        this.heap.push(element);
        this.nodeMap.set(this._nodeKey(node), element);
        this._bubbleUp(this.heap.length - 1);
    }
    
    /**
     * Dequeue the highest priority node
     * @returns {Object} The node with highest priority
     */
    dequeue() {
        if (this.isEmpty()) return null;
        
        const min = this.heap[0];
        const end = this.heap.pop();
        this.nodeMap.delete(this._nodeKey(min.node));
        
        if (this.heap.length > 0) {
            this.heap[0] = end;
            this.nodeMap.set(this._nodeKey(end.node), end);
            this._sinkDown(0);
        }
        
        return min.node;
    }
    
    /**
     * Check if queue contains a node
     * @param {Object} node - The node to check
     * @returns {boolean} True if node is in queue
     */
    contains(node) {
        return this.nodeMap.has(this._nodeKey(node));
    }
    
    /**
     * Update priority of a node
     * @param {Object} node - The node to update
     * @param {number} newPriority - New priority value
     */
    updatePriority(node, newPriority) {
        const key = this._nodeKey(node);
        const element = this.nodeMap.get(key);
        
        if (!element) return;
        
        const oldPriority = element.priority;
        element.priority = newPriority;
        
        if (newPriority < oldPriority) {
            // New priority is better (lower), bubble up
            const index = this.heap.indexOf(element);
            this._bubbleUp(index);
        } else {
            // New priority is worse (higher), sink down
            const index = this.heap.indexOf(element);
            this._sinkDown(index);
        }
    }
    
    /**
     * Check if queue is empty
     * @returns {boolean} True if queue is empty
     */
    isEmpty() {
        return this.heap.length === 0;
    }
    
    /**
     * Get queue size
     * @returns {number} Number of elements in queue
     */
    size() {
        return this.heap.length;
    }
    
    /**
     * Clear the queue
     */
    clear() {
        this.heap = [];
        this.nodeMap.clear();
    }
    
    /**
     * Helper: Bubble up element at index
     * @private
     */
    _bubbleUp(index) {
        const element = this.heap[index];
        
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            const parent = this.heap[parentIndex];
            
            if (element.priority >= parent.priority) break;
            
            // Swap with parent
            this.heap[parentIndex] = element;
            this.heap[index] = parent;
            
            // Update nodeMap
            this.nodeMap.set(this._nodeKey(element.node), element);
            this.nodeMap.set(this._nodeKey(parent.node), parent);
            
            index = parentIndex;
        }
    }
    
    /**
     * Helper: Sink down element at index
     * @private
     */
    _sinkDown(index) {
        const length = this.heap.length;
        const element = this.heap[index];
        
        while (true) {
            let leftChildIndex = 2 * index + 1;
            let rightChildIndex = 2 * index + 2;
            let swap = null;
            let leftChild, rightChild;
            
            if (leftChildIndex < length) {
                leftChild = this.heap[leftChildIndex];
                if (leftChild.priority < element.priority) {
                    swap = leftChildIndex;
                }
            }
            
            if (rightChildIndex < length) {
                rightChild = this.heap[rightChildIndex];
                if (
                    (swap === null && rightChild.priority < element.priority) ||
                    (swap !== null && rightChild.priority < leftChild.priority)
                ) {
                    swap = rightChildIndex;
                }
            }
            
            if (swap === null) break;
            
            // Swap with child
            this.heap[index] = this.heap[swap];
            this.heap[swap] = element;
            
            // Update nodeMap
            this.nodeMap.set(this._nodeKey(this.heap[index].node), this.heap[index]);
            this.nodeMap.set(this._nodeKey(element.node), element);
            
            index = swap;
        }
    }
    
    /**
     * Helper: Create unique key for node
     * @private
     */
    _nodeKey(node) {
        if (node.x !== undefined && node.y !== undefined) {
            return `${node.x},${node.y}`;
        }
        return JSON.stringify(node);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PriorityQueue;
}