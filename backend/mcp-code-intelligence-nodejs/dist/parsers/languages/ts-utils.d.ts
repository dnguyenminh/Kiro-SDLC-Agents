/**
 * KSA-146: TypeScript-specific AST helpers.
 * Utility functions for extracting TypeScript/JavaScript-specific constructs.
 */
import type { SyntaxNode } from '../types.js';
/** Check if a node is exported (direct export or parent is export_statement). */
export declare function isExported(node: SyntaxNode): boolean;
/** Check if a node has a specific modifier keyword (async, static, etc.). */
export declare function hasModifier(node: SyntaxNode, source: string, modifier: string): boolean;
/** Extract formal parameters text from a function/method node. */
export declare function extractParameters(node: SyntaxNode, source: string): string;
/** Extract return type annotation from a function/method node. */
export declare function extractReturnType(node: SyntaxNode, source: string): string | undefined;
/** Build a function signature string. */
export declare function buildFunctionSignature(name: string, params: string, returnType: string | undefined, isAsync: boolean): string;
/** Extract decorators/annotations from a node. */
export declare function extractDecorators(node: SyntaxNode, source: string): string[];
/** Extract heritage clauses (extends/implements) from class header text. */
export declare function extractHeritage(node: SyntaxNode, source: string): {
    name: string;
    kind: 'inherits' | 'implements';
}[];
/** Extract modifiers (public, private, protected, static, abstract, readonly). */
export declare function extractModifiers(node: SyntaxNode, source: string): string[];
//# sourceMappingURL=ts-utils.d.ts.map