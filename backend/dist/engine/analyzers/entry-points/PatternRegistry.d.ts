/**
 * KSA-162: Pattern Registry — Manages framework detection patterns.
 */
import type { PatternConfig, FrameworkPatterns } from './types.js';
export declare class PatternRegistry {
    private config;
    constructor(customConfig?: Partial<PatternConfig>);
    /** Get framework patterns by name. */
    getFramework(name: string): FrameworkPatterns | null;
    /** Get all framework names. */
    getFrameworkNames(): string[];
    /** Get frameworks for a specific language. */
    getFrameworksForLanguage(language: string): Array<{
        name: string;
        patterns: FrameworkPatterns;
    }>;
    /** Get main pattern for a language. */
    getMainPattern(language: string): {
        pattern: string;
        type: string;
    } | null;
    /** Get all import patterns for framework detection. */
    getAllImportPatterns(): Array<{
        framework: string;
        imports: string[];
    }>;
}
