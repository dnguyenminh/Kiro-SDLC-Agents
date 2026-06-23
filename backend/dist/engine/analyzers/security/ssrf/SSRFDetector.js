/**
 * KSA-166: SSRF Detector — Detects Server-Side Request Forgery vulnerabilities.
 */
import { TaintAnalyzer } from '../taint/TaintAnalyzer.js';
/** HTTP sink functions that make outbound requests. */
const HTTP_SINKS = [
    'fetch(', 'axios(', 'axios.get(', 'axios.post(', 'axios.put(', 'axios.delete(',
    'http.get(', 'http.request(', 'https.get(', 'https.request(',
    'request(', 'got(', 'got.get(', 'superagent.get(',
    'urllib.request.urlopen', 'requests.get(', 'requests.post(',
    'httpx.get(', 'httpx.post(',
];
/** URL validation patterns that mitigate SSRF. */
const URL_VALIDATORS = [
    'new URL(', 'URL.parse(', 'url.parse(',
    'allowedHosts', 'allowedDomains', 'whitelist',
    'isInternalUrl', 'validateUrl', 'isAllowedHost',
    'startsWith("http', 'startsWith("https',
];
export class SSRFDetector {
    taintAnalyzer;
    constructor(taintAnalyzer) {
        this.taintAnalyzer = taintAnalyzer ?? new TaintAnalyzer();
    }
    /** Detect SSRF in a function that handles HTTP requests. */
    detect(functionNode, filePath, language, handlerName) {
        const taintResult = this.taintAnalyzer.analyze(functionNode, language, {
            sinkTypes: ['url_fetch'],
        });
        const findings = [];
        for (const path of taintResult.paths) {
            // Only care about paths that end in HTTP sinks
            if (!this.isHTTPSink(path.sink.function))
                continue;
            // Check if URL validation exists in the path
            const hasValidation = this.hasURLValidation(path);
            if (hasValidation)
                continue;
            const trustTier = this.classifyTrustTier(path);
            const confidence = this.computeConfidence(path, trustTier);
            findings.push({
                handler: handlerName,
                filePath,
                source: path.source,
                sink: path.sink,
                path: path.chain.map(s => s.line),
                trustTier,
                confidence,
                missingControl: 'URL validation/allowlist',
                cwe: 'CWE-918',
                severity: trustTier === 'T1' ? 'Critical' : trustTier === 'T2' ? 'High' : 'Medium',
            });
        }
        return findings;
    }
    isHTTPSink(functionName) {
        return HTTP_SINKS.some(sink => functionName.includes(sink));
    }
    hasURLValidation(path) {
        // Check if any step in the chain involves URL validation
        for (const step of path.chain) {
            for (const validator of URL_VALIDATORS) {
                if (step.expression.includes(validator))
                    return true;
            }
        }
        // Also check sink expression
        for (const validator of URL_VALIDATORS) {
            if (path.sink.expression.includes(validator))
                return true;
        }
        return false;
    }
    classifyTrustTier(path) {
        if (path.length <= 2)
            return 'T1'; // Direct: param → fetch
        if (path.length <= 5)
            return 'T2'; // Partial processing
        return 'T3'; // Indirect
    }
    computeConfidence(path, tier) {
        if (tier === 'T1')
            return 95;
        if (tier === 'T2')
            return 75;
        return 50;
    }
}
//# sourceMappingURL=SSRFDetector.js.map