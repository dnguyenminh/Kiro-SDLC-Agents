"""
KSA-166: SSRF Detector — Detects Server-Side Request Forgery vulnerabilities.
"""

from __future__ import annotations
from typing import Any, Optional
from ..taint.taint_analyzer import TaintAnalyzer
from ..types import SSRFFinding, TaintPath, TaintOptions


_HTTP_SINKS = [
    "fetch(", "axios(", "axios.get(", "axios.post(", "axios.put(", "axios.delete(",
    "http.get(", "http.request(", "https.get(", "https.request(",
    "request(", "got(", "got.get(", "superagent.get(",
    "urllib.request.urlopen", "requests.get(", "requests.post(",
    "httpx.get(", "httpx.post(",
]

_URL_VALIDATORS = [
    "new URL(", "URL.parse(", "url.parse(",
    "allowedHosts", "allowedDomains", "whitelist",
    "isInternalUrl", "validateUrl", "isAllowedHost",
    'startsWith("http', 'startsWith("https',
]


class SSRFDetector:
    def __init__(self, taint_analyzer: Optional[TaintAnalyzer] = None) -> None:
        self._taint_analyzer = taint_analyzer or TaintAnalyzer()

    def detect(self, function_node: Any, file_path: str, language: str, handler_name: str) -> list[SSRFFinding]:
        """Detect SSRF in a function that handles HTTP requests."""
        taint_result = self._taint_analyzer.analyze(
            function_node, language, TaintOptions(sink_types=["url_fetch"])
        )

        findings: list[SSRFFinding] = []

        for path in taint_result.paths:
            if not self._is_http_sink(path.sink.function):
                continue
            if self._has_url_validation(path):
                continue

            trust_tier = self._classify_trust_tier(path)
            confidence = self._compute_confidence(trust_tier)

            findings.append(SSRFFinding(
                handler=handler_name,
                file_path=file_path,
                source=path.source,
                sink=path.sink,
                path=[s.line for s in path.chain],
                trust_tier=trust_tier,
                confidence=confidence,
                missing_control="URL validation/allowlist",
                cwe="CWE-918",
                severity="Critical" if trust_tier == "T1" else "High" if trust_tier == "T2" else "Medium",
            ))

        return findings

    def _is_http_sink(self, function_name: str) -> bool:
        return any(sink in function_name for sink in _HTTP_SINKS)

    def _has_url_validation(self, path: TaintPath) -> bool:
        for step in path.chain:
            for validator in _URL_VALIDATORS:
                if validator in step.expression:
                    return True
        for validator in _URL_VALIDATORS:
            if validator in path.sink.expression:
                return True
        return False

    def _classify_trust_tier(self, path: TaintPath) -> str:
        if path.length <= 2:
            return "T1"
        if path.length <= 5:
            return "T2"
        return "T3"

    def _compute_confidence(self, tier: str) -> int:
        if tier == "T1":
            return 95
        if tier == "T2":
            return 75
        return 50
