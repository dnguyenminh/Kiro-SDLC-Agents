"""
KSA-165: Injection Scanner — Main orchestrator for injection detection.
"""

from __future__ import annotations
from typing import Any, Optional
from ..taint.taint_analyzer import TaintAnalyzer
from .pattern_matcher import PatternMatcher, MatchContext
from .suppression_checker import SuppressionChecker
from .patterns import (
    SQLInjectionMatcher, XSSMatcher, CommandInjectionMatcher,
    PathTraversalMatcher, DeserializationMatcher, LDAPXMLMatcher,
)
from ..types import Finding, ScanOptions, ScanResult


_SEVERITY_ORDER = ["Critical", "High", "Medium", "Low", "Info"]


class InjectionScanner:
    def __init__(self, taint_analyzer: Optional[TaintAnalyzer] = None) -> None:
        self._taint_analyzer = taint_analyzer or TaintAnalyzer()
        self._suppression_checker = SuppressionChecker()
        self._matchers: list[PatternMatcher] = [
            SQLInjectionMatcher(),
            XSSMatcher(),
            CommandInjectionMatcher(),
            PathTraversalMatcher(),
            DeserializationMatcher(),
            LDAPXMLMatcher(),
        ]

    def scan_function(
        self,
        function_node: Any,
        file_path: str,
        language: str,
        source_lines: list[str],
        function_name: Optional[str] = None,
    ) -> list[Finding]:
        """Scan a function AST node for injection vulnerabilities."""
        taint_result = self._taint_analyzer.analyze(function_node, language)
        if not taint_result.paths:
            return []

        context = MatchContext(file_path=file_path, function_name=function_name or "anonymous", language=language)
        findings: list[Finding] = []

        for path in taint_result.paths:
            for matcher in self._matchers:
                finding = matcher.match(path, context)
                if finding:
                    suppression = self._suppression_checker.is_suppressed(source_lines, path.sink.line)
                    if suppression:
                        finding.suppressed = True
                        finding.suppression_info = {"marker": suppression.marker, "scope": suppression.scope, "line": suppression.line}
                    findings.append(finding)
                    break  # One finding per path

        return findings

    def scan_functions(
        self,
        functions: list[dict],  # [{node, name}]
        file_path: str,
        language: str,
        source_lines: list[str],
        options: Optional[ScanOptions] = None,
    ) -> ScanResult:
        """Scan multiple functions and aggregate results."""
        import time
        opts = options or ScanOptions()
        start_time = time.time()
        all_findings: list[Finding] = []
        suppressed: list[Finding] = []

        if self._suppression_checker.is_file_suppressed(source_lines):
            return self._empty_result(1, time.time() - start_time)

        for fn in functions:
            findings = self.scan_function(fn["node"], file_path, language, source_lines, fn.get("name"))
            for finding in findings:
                if opts.severity_threshold and not self._meets_threshold(finding.severity, opts.severity_threshold):
                    continue
                if opts.categories and finding.category not in opts.categories:
                    continue
                if finding.suppressed:
                    suppressed.append(finding)
                else:
                    all_findings.append(finding)

        duration = time.time() - start_time
        return ScanResult(
            findings=all_findings,
            suppressed=suppressed if opts.include_suppressed else [],
            summary={
                "total": len(all_findings),
                "by_severity": self._count_by_severity(all_findings),
                "by_category": self._count_by_category(all_findings),
                "files_scanned": 1,
                "scan_duration": duration,
            },
        )

    def _meets_threshold(self, severity: str, threshold: str) -> bool:
        return _SEVERITY_ORDER.index(severity) <= _SEVERITY_ORDER.index(threshold)

    def _count_by_severity(self, findings: list[Finding]) -> dict[str, int]:
        counts = {s: 0 for s in _SEVERITY_ORDER}
        for f in findings:
            counts[f.severity] = counts.get(f.severity, 0) + 1
        return counts

    def _count_by_category(self, findings: list[Finding]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for f in findings:
            counts[f.category] = counts.get(f.category, 0) + 1
        return counts

    def _empty_result(self, files_scanned: int, duration: float) -> ScanResult:
        return ScanResult(
            findings=[],
            suppressed=[],
            summary={"total": 0, "by_severity": {s: 0 for s in _SEVERITY_ORDER}, "by_category": {}, "files_scanned": files_scanned, "scan_duration": duration},
        )
