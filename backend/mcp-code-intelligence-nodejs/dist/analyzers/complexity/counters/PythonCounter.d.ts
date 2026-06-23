/**
 * KSA-161: Python decision point counter.
 */
import type { SyntaxNode } from '../../../parsers/types.js';
import { BaseNodeCounter } from './BaseNodeCounter.js';
export declare class PythonCounter extends BaseNodeCounter {
    readonly language = "python";
    readonly branchNodeTypes: string[];
    readonly loopNodeTypes: string[];
    readonly logicalOperators: string[];
    readonly exceptionNodeTypes: string[];
    protected isLogicalOp(node: SyntaxNode): boolean;
    protected getReturnNodeTypes(): string[];
}
//# sourceMappingURL=PythonCounter.d.ts.map