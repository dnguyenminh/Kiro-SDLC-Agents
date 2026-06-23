/**
 * KSA-166: SSRF Detector — Detects Server-Side Request Forgery vulnerabilities.
 */
package com.codeintel.analyzers.security.ssrf

import com.codeintel.analyzers.security.*
import com.codeintel.analyzers.security.taint.TaintAnalyzer
import com.codeintel.parsers.SyntaxNode

private val HTTP_SINKS = listOf(
    "fetch(", "axios(", "axios.get(", "axios.post(", "axios.put(", "axios.delete(",
    "http.get(", "http.request(", "https.get(", "https.request(",
    "request(", "got(", "got.get(", "superagent.get(",
    "urllib.request.urlopen", "requests.get(", "requests.post(",
    "httpx.get(", "httpx.post("
)

private val URL_VALIDATORS = listOf(
    "new URL(", "URL.parse(", "url.parse(",
    "allowedHosts", "allowedDomains", "whitelist",
    "isInternalUrl", "validateUrl", "isAllowedHost",
    "startsWith(\"http", "startsWith(\"https"
)

class SSRFDetector(taintAnalyzer: TaintAnalyzer? = null) {
    private val taintAnalyzer = taintAnalyzer ?: TaintAnalyzer()

    fun detect(functionNode: SyntaxNode, filePath: String, language: String, handlerName: String): List<SSRFFinding> {
        val taintResult = taintAnalyzer.analyze(functionNode, language, TaintOptions(sinkTypes = listOf(TaintSinkType.URL_FETCH)))
        val findings = mutableListOf<SSRFFinding>()

        for (path in taintResult.paths) {
            if (!isHTTPSink(path.sink.function)) continue
            if (hasURLValidation(path)) continue

            val trustTier = classifyTrustTier(path)
            val confidence = when (trustTier) { TrustTier.T1 -> 95; TrustTier.T2 -> 75; else -> 50 }
            val severity = when (trustTier) { TrustTier.T1 -> Severity.CRITICAL; TrustTier.T2 -> Severity.HIGH; else -> Severity.MEDIUM }

            findings.add(SSRFFinding(
                handler = handlerName, filePath = filePath,
                source = path.source, sink = path.sink,
                path = path.chain.map { it.line },
                trustTier = trustTier, confidence = confidence,
                missingControl = "URL validation/allowlist",
                cwe = "CWE-918", severity = severity
            ))
        }
        return findings
    }

    private fun isHTTPSink(functionName: String) = HTTP_SINKS.any { it in functionName }

    private fun hasURLValidation(path: TaintPath): Boolean {
        for (step in path.chain) {
            if (URL_VALIDATORS.any { it in step.expression }) return true
        }
        return URL_VALIDATORS.any { it in path.sink.expression }
    }

    private fun classifyTrustTier(path: TaintPath): TrustTier = when {
        path.length <= 2 -> TrustTier.T1
        path.length <= 5 -> TrustTier.T2
        else -> TrustTier.T3
    }
}
