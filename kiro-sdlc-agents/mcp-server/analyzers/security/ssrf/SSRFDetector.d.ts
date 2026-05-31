/**
 * KSA-166: SSRF Detector — Detects Server-Side Request Forgery vulnerabilities.
 */
import { TaintAnalyzer } from '../taint/TaintAnalyzer.js';
import type { SyntaxNode } from '../../../parsers/types.js';
import type { SSRFFinding } from '../types.js';
export declare class SSRFDetector {
    private taintAnalyzer;
    constructor(taintAnalyzer?: TaintAnalyzer);
    /** Detect SSRF in a function that handles HTTP requests. */
    detect(functionNode: SyntaxNode, filePath: string, language: string, handlerName: string): SSRFFinding[];
    private isHTTPSink;
    private hasURLValidation;
    private classifyTrustTier;
    private computeConfidence;
}
//# sourceMappingURL=SSRFDetector.d.ts.map