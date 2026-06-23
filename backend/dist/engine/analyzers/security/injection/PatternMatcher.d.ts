/**
 * KSA-165: Pattern Matcher — Base class for injection pattern matching.
 */
import type { TaintPath, InjectionPattern, Finding, Confidence } from '../types.js';
export interface MatchContext {
    filePath: string;
    functionName: string;
    language: string;
}
export declare abstract class PatternMatcher {
    abstract readonly category: string;
    abstract readonly patterns: InjectionPattern[];
    /** Check if a taint path matches any pattern in this category. */
    match(taintPath: TaintPath, context: MatchContext): Finding | null;
    /** Check if sink function matches pattern's sink signatures. */
    protected matchesSink(sinkFunction: string, pattern: InjectionPattern): boolean;
    /** Check if taint path has a dangerous operation. */
    protected hasDangerousOp(path: TaintPath, dangerousOps: string[]): boolean;
    /** Check if taint path has a safe pattern (sanitization). */
    protected hasSafePattern(path: TaintPath, safePatterns: string[]): boolean;
    /** Create a finding from a matched pattern. */
    protected createFinding(path: TaintPath, pattern: InjectionPattern, context: MatchContext): Finding;
    /** Compute confidence based on path characteristics. */
    protected computeConfidence(path: TaintPath, pattern: InjectionPattern): Confidence;
}
