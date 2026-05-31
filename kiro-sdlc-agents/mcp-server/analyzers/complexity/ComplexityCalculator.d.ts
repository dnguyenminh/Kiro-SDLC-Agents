/**
 * KSA-161: Core complexity calculation engine.
 * Delegates to language-specific counters via strategy pattern.
 */
import type { SyntaxNode } from '../../parsers/types.js';
import type { ComplexityBreakdown } from './types.js';
import { BaseNodeCounter } from './counters/BaseNodeCounter.js';
export declare class ComplexityCalculator {
    private counters;
    constructor();
    /** Register a language-specific counter. */
    registerCounter(counter: BaseNodeCounter): void;
    /** Calculate cyclomatic complexity for a function body AST node. */
    calculate(bodyNode: SyntaxNode, language: string): ComplexityBreakdown | null;
    /** Check if a language is supported. */
    supportsLanguage(language: string): boolean;
    /** Get list of supported languages. */
    getSupportedLanguages(): string[];
}
//# sourceMappingURL=ComplexityCalculator.d.ts.map