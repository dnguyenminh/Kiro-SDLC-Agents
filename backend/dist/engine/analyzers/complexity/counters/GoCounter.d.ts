/**
 * KSA-161: Go decision point counter.
 */
import type { SyntaxNode } from '../../../parsers/types.js';
import { BaseNodeCounter } from './BaseNodeCounter.js';
export declare class GoCounter extends BaseNodeCounter {
    readonly language = "go";
    readonly branchNodeTypes: string[];
    readonly loopNodeTypes: string[];
    readonly logicalOperators: string[];
    readonly exceptionNodeTypes: string[];
    protected isLogicalOp(node: SyntaxNode): boolean;
    protected getReturnNodeTypes(): string[];
}
