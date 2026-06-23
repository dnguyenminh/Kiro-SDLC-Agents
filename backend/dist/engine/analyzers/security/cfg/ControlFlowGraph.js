/**
 * KSA-164: Control Flow Graph — Container for basic blocks and edges.
 */
import { CFGEdge } from './CFGEdge.js';
export class ControlFlowGraph {
    entry;
    exits = [];
    blocks = [];
    edges = [];
    adjacency = new Map();
    reverseAdj = new Map();
    constructor(entry) {
        this.entry = entry;
        this.addBlock(entry);
    }
    addBlock(block) {
        this.blocks.push(block);
        this.adjacency.set(block.id, []);
        this.reverseAdj.set(block.id, []);
        if (block.type === 'exit')
            this.exits.push(block);
    }
    addEdge(from, to, type, label) {
        const edge = new CFGEdge(from, to, type, label);
        this.edges.push(edge);
        this.adjacency.get(from.id).push(edge);
        this.reverseAdj.get(to.id).push(edge);
        return edge;
    }
    getSuccessors(block) {
        return (this.adjacency.get(block.id) ?? []).map(e => e.to);
    }
    getPredecessors(block) {
        return (this.reverseAdj.get(block.id) ?? []).map(e => e.from);
    }
    getOutEdges(block) {
        return this.adjacency.get(block.id) ?? [];
    }
    getInEdges(block) {
        return this.reverseAdj.get(block.id) ?? [];
    }
    /** Topological sort using DFS (for acyclic portions). */
    topologicalOrder() {
        const visited = new Set();
        const result = [];
        const dfs = (block) => {
            if (visited.has(block.id))
                return;
            visited.add(block.id);
            for (const succ of this.getSuccessors(block)) {
                dfs(succ);
            }
            result.unshift(block);
        };
        dfs(this.entry);
        return result;
    }
    /** Reverse post-order traversal (optimal for dataflow iteration). */
    reversePostOrder() {
        const visited = new Set();
        const postOrder = [];
        const dfs = (block) => {
            if (visited.has(block.id))
                return;
            visited.add(block.id);
            for (const succ of this.getSuccessors(block)) {
                dfs(succ);
            }
            postOrder.push(block);
        };
        dfs(this.entry);
        return postOrder.reverse();
    }
    /** Get block by ID. */
    getBlock(id) {
        return this.blocks.find(b => b.id === id);
    }
    /** Summary for debugging. */
    toString() {
        const lines = [`CFG: ${this.blocks.length} blocks, ${this.edges.length} edges`];
        for (const edge of this.edges) {
            lines.push(`  ${edge.toString()}`);
        }
        return lines.join('\n');
    }
}
//# sourceMappingURL=ControlFlowGraph.js.map