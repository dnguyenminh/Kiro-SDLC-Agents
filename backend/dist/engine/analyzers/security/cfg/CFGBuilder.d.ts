/**
 * KSA-164: CFG Builder — Constructs control flow graphs from AST function nodes.
 * Handles if/else, loops, try/catch, switch, and early returns.
 */
import type { SyntaxNode } from '../../../parsers/types.js';
import { ControlFlowGraph } from './ControlFlowGraph.js';
export declare class CFGBuilder {
    private blockCounter;
    private cfg;
    /** Build CFG from a function AST node. */
    build(functionNode: SyntaxNode, language: string): ControlFlowGraph;
    private getFunctionBody;
    private processStatements;
    private processStatement;
    private handleIf;
    private handleWhile;
    private handleFor;
    private handleTryCatch;
    private handleSwitch;
    private processBlockOrStatement;
    private newBlock;
}
