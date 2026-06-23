/**
 * KSA-161: Java decision point counter.
 */
import type { SyntaxNode } from '../../../parsers/types.js';
import { BaseNodeCounter } from './BaseNodeCounter.js';
export declare class JavaCounter extends BaseNodeCounter {
    readonly language = "java";
    readonly branchNodeTypes: string[];
    readonly loopNodeTypes: string[];
    readonly logicalOperators: string[];
    readonly exceptionNodeTypes: string[];
    protected isLogicalOp(node: SyntaxNode): boolean;
}
