"use strict";
/**
 * KSA-165: Pattern Matcher — Base class for injection pattern matching.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternMatcher = void 0;
class PatternMatcher {
    /** Check if a taint path matches any pattern in this category. */
    match(taintPath, context) {
        for (const pattern of this.patterns) {
            if (this.matchesSink(taintPath.sink.function, pattern) &&
                this.hasDangerousOp(taintPath, pattern.dangerousOps) &&
                !this.hasSafePattern(taintPath, pattern.safePatterns)) {
                return this.createFinding(taintPath, pattern, context);
            }
        }
        return null;
    }
    /** Check if sink function matches pattern's sink signatures. */
    matchesSink(sinkFunction, pattern) {
        return pattern.sinkPatterns.some(sp => sinkFunction.includes(sp));
    }
    /** Check if taint path has a dangerous operation. */
    hasDangerousOp(path, dangerousOps) {
        if (dangerousOps.length === 0)
            return true; // No specific op required
        return path.chain.some(step => dangerousOps.includes(step.action));
    }
    /** Check if taint path has a safe pattern (sanitization). */
    hasSafePattern(path, safePatterns) {
        if (safePatterns.length === 0)
            return false;
        const sinkExpr = path.sink.expression;
        for (const safe of safePatterns) {
            if (sinkExpr.includes(safe))
                return true;
        }
        // Check if any step is a sanitizer
        return path.chain.some(step => step.action === 'sanitize');
    }
    /** Create a finding from a matched pattern. */
    createFinding(path, pattern, context) {
        const confidence = this.computeConfidence(path, pattern);
        return {
            id: `${pattern.category.toUpperCase()}-${pattern.id}-${context.filePath}:${path.sink.line}`,
            ruleId: `INJ-${pattern.category.toUpperCase()}-${String(pattern.id).padStart(3, '0')}`,
            category: pattern.category,
            pattern,
            taintPath: path,
            severity: pattern.severity,
            confidence,
            cwe: pattern.cwe,
            message: `${pattern.name}: Tainted data from ${path.source.type} flows to ${path.sink.function} without sanitization`,
            remediation: pattern.description,
            location: {
                file: context.filePath,
                startLine: path.source.line,
                endLine: path.sink.line,
            },
            suppressed: false,
        };
    }
    /** Compute confidence based on path characteristics. */
    computeConfidence(path, pattern) {
        // Short direct paths = high confidence
        if (path.length <= 3)
            return 'High';
        // Medium paths
        if (path.length <= 6)
            return 'Medium';
        // Long indirect paths
        return 'Low';
    }
}
exports.PatternMatcher = PatternMatcher;
//# sourceMappingURL=PatternMatcher.js.map