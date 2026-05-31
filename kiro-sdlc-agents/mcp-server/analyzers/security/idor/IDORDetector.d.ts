/**
 * KSA-166: IDOR Detector — Detects Insecure Direct Object Reference vulnerabilities.
 */
import { TaintAnalyzer } from '../taint/TaintAnalyzer.js';
import type { SyntaxNode } from '../../../parsers/types.js';
import type { IDORFinding } from '../types.js';
export declare class IDORDetector {
    private taintAnalyzer;
    constructor(taintAnalyzer?: TaintAnalyzer);
    /** Detect IDOR in a handler function. */
    detect(functionNode: SyntaxNode, filePath: string, language: string, handlerName: string): IDORFinding[];
    /** Find parameters that look like object IDs. */
    private findIDParams;
    /** Find database lookup using the ID parameter. */
    private findDBLookup;
    /** Check if there's an authorization check for the given parameter. */
    private hasAuthorizationCheck;
    /** Classify trust tier based on directness. */
    private classifyTrustTier;
    private isNearby;
}
//# sourceMappingURL=IDORDetector.d.ts.map