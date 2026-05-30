/**
 * KSA-145: AST Utilities — Shared tree-sitter AST traversal helpers.
 * Provides efficient iterative tree walking, node search, and text extraction.
 */
import type { SyntaxNode, NodeVisitor } from './types.js';
/**
 * Iterative depth-first tree walk (avoids stack overflow on deep ASTs).
 * Visitor.enter() returning false skips children.
 */
export declare function walkTree(node: SyntaxNode, visitor: NodeVisitor): void;
/** Find all nodes of a given type in the subtree. */
export declare function findNodes(node: SyntaxNode, type: string): SyntaxNode[];
/** Find first node of a given type (stops early). */
export declare function findFirst(node: SyntaxNode, type: string): SyntaxNode | null;
/** Get text content of a node from source. */
export declare function getNodeText(node: SyntaxNode, source: string): string;
/** Get 1-based line range of a node. */
export declare function getNodeRange(node: SyntaxNode): {
    startLine: number;
    endLine: number;
};
/** Walk up the tree to find an ancestor of a specific type. */
export declare function getAncestorOfType(node: SyntaxNode, type: string): SyntaxNode | null;
/** Get direct children of a specific type. */
export declare function getChildrenOfType(node: SyntaxNode, type: string): SyntaxNode[];
/** Get the first named child of a specific type. */
export declare function getNamedChild(node: SyntaxNode, type: string): SyntaxNode | null;
/** Extract doc comment above a node (JSDoc, Python docstring, etc.). */
export declare function extractDocComment(node: SyntaxNode, source: string): string | null;
/** Calculate cyclomatic complexity of a function body. */
export declare function calculateComplexity(node: SyntaxNode): number;
//# sourceMappingURL=ast-utils.d.ts.map