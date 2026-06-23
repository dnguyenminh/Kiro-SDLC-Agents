/**
 * Pattern Detector — Identifies DI style, error handling, naming, logging, testing patterns.
 * Ported from: .analysis/code-intelligence/scripts/nodejs/src/full-indexer.ts
 */
import type { ExtractedSymbol } from './signature-extractor.js';
export interface DetectedPatterns {
    diStyle: string;
    errorHandling: string;
    naming: string;
    logging: string;
    testing: string;
}
/** Detect all coding patterns from aggregated module data. */
export declare function detectPatterns(classes: ExtractedSymbol[], functions: ExtractedSymbol[], imports: string[]): DetectedPatterns;
/** Infer module purpose from name, classes, and packages. */
export declare function inferModulePurpose(moduleName: string, classes: ExtractedSymbol[], packages: string[]): string;
