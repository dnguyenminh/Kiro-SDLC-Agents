/**
 * KSA-164: Data Flow Analyzer — Computes def-use chains from CFG + reaching definitions.
 */
import { ControlFlowGraph } from '../cfg/ControlFlowGraph.js';
import type { DataFlowResult } from '../types.js';
export declare class DataFlowAnalyzer {
    private reachingDefs;
    /** Analyze data flow for a control flow graph. */
    analyze(cfg: ControlFlowGraph): DataFlowResult;
    /** Collect all definitions across all blocks. */
    private collectAllDefinitions;
    /** Build def-use chains: for each definition, find all uses that it reaches. */
    private buildDefUseChains;
}
