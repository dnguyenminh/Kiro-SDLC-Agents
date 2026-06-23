/**
 * KSA-164: Taint Propagator — Propagates taint state through CFG blocks.
 */
import type { SyntaxNode } from '../../../parsers/types.js';
import type { BasicBlock } from '../cfg/BasicBlock.js';
import type { TaintStep } from '../types.js';
import { TaintRegistry } from './TaintRegistry.js';
export interface TaintState {
    variable: string;
    tainted: boolean;
    sourceType: string;
    sourceLine: number;
    steps: TaintStep[];
}
export declare class TaintPropagator {
    private registry;
    constructor(registry: TaintRegistry);
    /** Propagate taint through a single block, updating state map. */
    propagateBlock(block: BasicBlock, state: Map<string, TaintState>): Map<string, TaintState>;
    /** Propagate taint for a single statement. */
    private propagateStatement;
    private handleDeclaration;
    private handleAssignment;
    private propagateExpression;
    /** Evaluate if an expression produces a tainted value. */
    evaluateExpression(node: SyntaxNode, state: Map<string, TaintState>): {
        tainted: boolean;
        sourceType: string;
        sourceLine: number;
        steps: TaintStep[];
        action: TaintStep['action'];
    };
    /** Check if a call expression is a sanitizer. */
    private isSanitizerCall;
}
