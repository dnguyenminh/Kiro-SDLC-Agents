/**
 * KSA-164: Control Flow Graph — Container for basic blocks and edges.
 */
import { BasicBlock } from './BasicBlock.js';
import { CFGEdge } from './CFGEdge.js';
import type { EdgeType } from '../types.js';
export declare class ControlFlowGraph {
    readonly entry: BasicBlock;
    readonly exits: BasicBlock[];
    readonly blocks: BasicBlock[];
    readonly edges: CFGEdge[];
    private adjacency;
    private reverseAdj;
    constructor(entry: BasicBlock);
    addBlock(block: BasicBlock): void;
    addEdge(from: BasicBlock, to: BasicBlock, type: EdgeType, label?: string): CFGEdge;
    getSuccessors(block: BasicBlock): BasicBlock[];
    getPredecessors(block: BasicBlock): BasicBlock[];
    getOutEdges(block: BasicBlock): CFGEdge[];
    getInEdges(block: BasicBlock): CFGEdge[];
    /** Topological sort using DFS (for acyclic portions). */
    topologicalOrder(): BasicBlock[];
    /** Reverse post-order traversal (optimal for dataflow iteration). */
    reversePostOrder(): BasicBlock[];
    /** Get block by ID. */
    getBlock(id: number): BasicBlock | undefined;
    /** Summary for debugging. */
    toString(): string;
}
//# sourceMappingURL=ControlFlowGraph.d.ts.map