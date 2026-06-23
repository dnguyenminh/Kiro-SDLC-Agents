/**
 * KSA-164: Basic Block — Fundamental unit of a control flow graph.
 */
import type { SyntaxNode } from '../../../parsers/types.js';
import type { BlockType, Statement, VariableDef, VariableUse } from '../types.js';
export declare class BasicBlock {
    readonly id: number;
    readonly type: BlockType;
    readonly statements: Statement[];
    startLine: number;
    endLine: number;
    constructor(id: number, type: BlockType);
    addStatement(node: SyntaxNode): void;
    /** Extract variable definitions from this block's statements. */
    getDefinitions(): VariableDef[];
    /** Extract variable uses from this block's statements. */
    getUses(): VariableUse[];
    get isEmpty(): boolean;
}
