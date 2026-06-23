/**
 * KSA-161: Abstract base class for language-specific AST node counters.
 * Each language subclass defines which node types represent decision points.
 */
import type { SyntaxNode } from '../../../parsers/types.js';
import type { DecisionPointCounts } from '../types.js';
export declare abstract class BaseNodeCounter {
    abstract readonly language: string;
    abstract readonly branchNodeTypes: string[];
    abstract readonly loopNodeTypes: string[];
    abstract readonly logicalOperators: string[];
    abstract readonly exceptionNodeTypes: string[];
    /** Count all decision points in an AST subtree (single pass). */
    countDecisionPoints(node: SyntaxNode): DecisionPointCounts;
    /** Calculate maximum nesting depth of control structures. */
    calculateNestingDepth(node: SyntaxNode): number;
    /** Count early return statements in a function body. */
    countEarlyReturns(node: SyntaxNode): number;
    /** Override in subclass to check if a node represents a logical operator. */
    protected isLogicalOp(node: SyntaxNode): boolean;
    /** Override in subclass for language-specific return node types. */
    protected getReturnNodeTypes(): string[];
    /** Walk all nodes in the tree, calling visitor for each. */
    protected walkTree(node: SyntaxNode, visitor: (n: SyntaxNode) => void): void;
}
//# sourceMappingURL=BaseNodeCounter.d.ts.map