"use strict";
/**
 * KSA-165: Injection Scanner — Main orchestrator for injection detection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InjectionScanner = void 0;
const TaintAnalyzer_js_1 = require("../taint/TaintAnalyzer.js");
const SuppressionChecker_js_1 = require("./SuppressionChecker.js");
const SQLInjectionMatcher_js_1 = require("./patterns/SQLInjectionMatcher.js");
const XSSMatcher_js_1 = require("./patterns/XSSMatcher.js");
const CommandInjectionMatcher_js_1 = require("./patterns/CommandInjectionMatcher.js");
const PathTraversalMatcher_js_1 = require("./patterns/PathTraversalMatcher.js");
const DeserializationMatcher_js_1 = require("./patterns/DeserializationMatcher.js");
const LDAPXMLMatcher_js_1 = require("./patterns/LDAPXMLMatcher.js");
class InjectionScanner {
    taintAnalyzer;
    matchers;
    suppressionChecker;
    constructor(taintAnalyzer) {
        this.taintAnalyzer = taintAnalyzer ?? new TaintAnalyzer_js_1.TaintAnalyzer();
        this.suppressionChecker = new SuppressionChecker_js_1.SuppressionChecker();
        this.matchers = [
            new SQLInjectionMatcher_js_1.SQLInjectionMatcher(),
            new XSSMatcher_js_1.XSSMatcher(),
            new CommandInjectionMatcher_js_1.CommandInjectionMatcher(),
            new PathTraversalMatcher_js_1.PathTraversalMatcher(),
            new DeserializationMatcher_js_1.DeserializationMatcher(),
            new LDAPXMLMatcher_js_1.LDAPXMLMatcher(),
        ];
    }
    /** Scan a function AST node for injection vulnerabilities. */
    scanFunction(functionNode, filePath, language, sourceLines, functionName) {
        // Run taint analysis
        const taintResult = this.taintAnalyzer.analyze(functionNode, language);
        if (taintResult.paths.length === 0)
            return [];
        const context = {
            filePath,
            functionName: functionName ?? 'anonymous',
            language,
        };
        const findings = [];
        // Match each taint path against all patterns
        for (const path of taintResult.paths) {
            for (const matcher of this.matchers) {
                const finding = matcher.match(path, context);
                if (finding) {
                    // Check suppression
                    const suppression = this.suppressionChecker.isSuppressed(sourceLines, path.sink.line);
                    if (suppression) {
                        finding.suppressed = true;
                        finding.suppressionInfo = suppression;
                    }
                    findings.push(finding);
                    break; // One finding per path (first match wins)
                }
            }
        }
        return findings;
    }
    /** Scan multiple functions and aggregate results. */
    scanFunctions(functions, filePath, language, sourceLines, options = {}) {
        const startTime = Date.now();
        const allFindings = [];
        const suppressed = [];
        // Check file-level suppression
        if (this.suppressionChecker.isFileSuppressed(sourceLines)) {
            return this.emptyResult(1, Date.now() - startTime);
        }
        for (const fn of functions) {
            const findings = this.scanFunction(fn.node, filePath, language, sourceLines, fn.name);
            for (const finding of findings) {
                // Apply severity threshold
                if (options.severityThreshold && !this.meetsThreshold(finding.severity, options.severityThreshold)) {
                    continue;
                }
                // Apply category filter
                if (options.categories && !options.categories.includes(finding.category)) {
                    continue;
                }
                if (finding.suppressed) {
                    suppressed.push(finding);
                }
                else {
                    allFindings.push(finding);
                }
            }
        }
        const duration = Date.now() - startTime;
        return {
            findings: allFindings,
            suppressed: options.includeSuppressed ? suppressed : [],
            summary: {
                total: allFindings.length,
                bySeverity: this.countBySeverity(allFindings),
                byCategory: this.countByCategory(allFindings),
                filesScanned: 1,
                scanDuration: duration,
            },
        };
    }
    /** Get all registered patterns (for SARIF rule generation). */
    getAllPatterns() {
        return this.matchers.map(m => ({ category: m.category, patterns: m.patterns }));
    }
    meetsThreshold(severity, threshold) {
        const order = ['Critical', 'High', 'Medium', 'Low', 'Info'];
        return order.indexOf(severity) <= order.indexOf(threshold);
    }
    countBySeverity(findings) {
        const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
        for (const f of findings)
            counts[f.severity]++;
        return counts;
    }
    countByCategory(findings) {
        const counts = {};
        for (const f of findings) {
            counts[f.category] = (counts[f.category] ?? 0) + 1;
        }
        return counts;
    }
    emptyResult(filesScanned, duration) {
        return {
            findings: [],
            suppressed: [],
            summary: {
                total: 0,
                bySeverity: { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 },
                byCategory: {},
                filesScanned,
                scanDuration: duration,
            },
        };
    }
}
exports.InjectionScanner = InjectionScanner;
//# sourceMappingURL=InjectionScanner.js.map