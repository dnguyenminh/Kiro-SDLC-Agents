/**
 * KSA-165: Injection Scanner — Main orchestrator for injection detection.
 */
import type { SyntaxNode } from '../../../parsers/types.js';
import { TaintAnalyzer } from '../taint/TaintAnalyzer.js';
import type { Finding, ScanOptions, ScanResult } from '../types.js';
export declare class InjectionScanner {
    private taintAnalyzer;
    private matchers;
    private suppressionChecker;
    constructor(taintAnalyzer?: TaintAnalyzer);
    /** Scan a function AST node for injection vulnerabilities. */
    scanFunction(functionNode: SyntaxNode, filePath: string, language: string, sourceLines: string[], functionName?: string): Finding[];
    /** Scan multiple functions and aggregate results. */
    scanFunctions(functions: Array<{
        node: SyntaxNode;
        name: string;
    }>, filePath: string, language: string, sourceLines: string[], options?: ScanOptions): ScanResult;
    /** Get all registered patterns (for SARIF rule generation). */
    getAllPatterns(): Array<{
        category: string;
        patterns: import('../types.js').InjectionPattern[];
    }>;
    private meetsThreshold;
    private countBySeverity;
    private countByCategory;
    private emptyResult;
}
//# sourceMappingURL=InjectionScanner.d.ts.map