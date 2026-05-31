/**
 * KSA-164: Reaching Definitions — Iterative dataflow algorithm.
 * Computes which definitions reach each basic block.
 */
import { ControlFlowGraph } from '../cfg/ControlFlowGraph.js';
import type { Definition } from '../types.js';
export declare class ReachingDefinitions {
    private defCounter;
    /** Compute reaching definitions for all blocks in the CFG. */
    compute(cfg: ControlFlowGraph): Map<number, Set<Definition>>;
    /** GEN set: definitions created in this block. */
    private gen;
    /** Check if a block kills a definition (redefines the same variable). */
    private kills;
    private setsEqual;
}
//# sourceMappingURL=ReachingDefinitions.d.ts.map