/**
 * KSA-161: TypeScript/JavaScript decision point counter.
 */
import type { SyntaxNode } from '../../../parsers/types.js';
import { BaseNodeCounter } from './BaseNodeCounter.js';
export declare class TypeScriptCounter extends BaseNodeCounter {
    readonly language = "typescript";
    readonly branchNodeTypes: string[];
    readonly loopNodeTypes: string[];
    readonly logicalOperators: string[];
    readonly exceptionNodeTypes: string[];
    protected isLogicalOp(node: SyntaxNode): boolean;
}
//# sourceMappingURL=TypeScriptCounter.d.ts.map