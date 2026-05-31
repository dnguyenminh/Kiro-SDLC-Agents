/**
 * KSA-161: Kotlin decision point counter.
 */
import type { SyntaxNode } from '../../../parsers/types.js';
import { BaseNodeCounter } from './BaseNodeCounter.js';
export declare class KotlinCounter extends BaseNodeCounter {
    readonly language = "kotlin";
    readonly branchNodeTypes: string[];
    readonly loopNodeTypes: string[];
    readonly logicalOperators: string[];
    readonly exceptionNodeTypes: string[];
    protected isLogicalOp(node: SyntaxNode): boolean;
    protected getReturnNodeTypes(): string[];
}
//# sourceMappingURL=KotlinCounter.d.ts.map