/**
 * KSA-161: Complexity Analyzer — Main orchestrator.
 * Coordinates calculation, grading, and storage.
 */
import Database from 'better-sqlite3';
import type { SyntaxNode } from '../../parsers/types.js';
import type { ComplexityResult, ComplexityFilters, ComplexityQueryResult, FileComplexityResult } from './types.js';
export declare class ComplexityAnalyzer {
    private calculator;
    private grader;
    private store;
    private db;
    constructor(db: Database.Database);
    /** Analyze a single function given its body AST node. */
    analyzeFunction(symbolId: number, symbolName: string, filePath: string, startLine: number, endLine: number, bodyNode: SyntaxNode, language: string): ComplexityResult | null;
    /** Analyze all functions in a file (from DB symbols). Returns file-level summary. */
    analyzeFileFromDB(filePath: string, parseAndGetBody: (symbolId: number, startLine: number, endLine: number) => SyntaxNode | null): FileComplexityResult;
    /** Query stored complexity results with filters. */
    query(filters: ComplexityFilters): ComplexityQueryResult;
    /** Get complexity for a specific symbol by name. */
    getBySymbolName(symbolName: string, filePath?: string): ComplexityResult | null;
    /** Check if calculator supports a language. */
    supportsLanguage(language: string): boolean;
}
//# sourceMappingURL=ComplexityAnalyzer.d.ts.map