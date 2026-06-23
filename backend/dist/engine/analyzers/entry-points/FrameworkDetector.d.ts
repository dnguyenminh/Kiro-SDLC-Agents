/**
 * KSA-162: Framework Detector — Identifies frameworks from import statements.
 */
import type { FrameworkInfo } from './types.js';
import { PatternRegistry } from './PatternRegistry.js';
export declare class FrameworkDetector {
    private registry;
    constructor(registry: PatternRegistry);
    /** Detect framework from file source code (import analysis). */
    detect(source: string, language: string): FrameworkInfo | null;
    /** Detect framework from a list of import strings (from relationships table). */
    detectFromImports(imports: string[], language: string): FrameworkInfo | null;
}
