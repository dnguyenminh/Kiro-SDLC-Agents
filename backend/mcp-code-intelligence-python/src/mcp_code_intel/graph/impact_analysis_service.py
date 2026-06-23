"""Impact Analysis Service — blast radius prediction. KSA-179."""

from __future__ import annotations

import sqlite3
import time

from .call_graph_service import CallGraphService
from .dependency_graph_service import DependencyGraphService
from .models import (
    BlastRadius, ImpactAction, ImpactItem, ImpactResult,
    RelatedTest, ResolvedSymbol, Severity,
)
from .symbol_resolver import SymbolResolver
from .test_detector import TestDetector


class ImpactAnalysisService:
    """Combines call graph + dependency graph + test detection for impact analysis."""

    _SEVERITY_ORDER = {Severity.CRITICAL: 0, Severity.HIGH: 1, Severity.MEDIUM: 2, Severity.LOW: 3}

    def __init__(
        self,
        conn: sqlite3.Connection,
        call_graph: CallGraphService,
        dep_graph: DependencyGraphService,
        resolver: SymbolResolver,
        test_detector: TestDetector,
    ) -> None:
        self._conn = conn
        self._call_graph = call_graph
        self._dep_graph = dep_graph
        self._resolver = resolver
        self._test_detector = test_detector

    def analyze_impact(
        self,
        symbol_name: str,
        action: ImpactAction = ImpactAction.MODIFY,
        depth: int = 3,
        include_tests: bool = True,
        severity_threshold: Severity = Severity.LOW,
    ) -> ImpactResult:
        """Analyze the impact of modifying/deleting/renaming a symbol."""
        start_time = time.time()
        clamped_depth = min(max(depth, 1), 5)

        resolved = self._resolver.resolve(symbol_name)
        if not resolved:
            return self._empty_result(symbol_name, action)

        impacts: list[ImpactItem] = []
        source_file = resolved[0].file_path

        # 1. Find callers via call graph
        caller_result = self._call_graph.find_callers(symbol_name, clamped_depth, 100)
        for caller in caller_result.results:
            severity = self._classify_severity(caller.depth_level, action)
            impacts.append(ImpactItem(
                symbol=caller.symbol,
                qualified_name=caller.qualified_name,
                file=caller.file_path,
                line=caller.call_site_line,
                severity=severity,
                reason=f"Direct caller" if caller.depth_level == 1 else f"Transitive caller (depth {caller.depth_level})",
            ))

        # 2. Find interface implementors
        impacts.extend(self._find_implementor_impacts(resolved, symbol_name))

        # 3. Find file-level dependents
        dep_result = self._dep_graph.query(source_file, "incoming", min(clamped_depth, 2), False, 50)
        for dep in dep_result.results:
            if not any(i.file == dep.file for i in impacts):
                impacts.append(ImpactItem(
                    symbol=dep.file,
                    file=dep.file,
                    line=0,
                    severity=Severity.HIGH if action == ImpactAction.DELETE else Severity.MEDIUM,
                    reason="Imports modified file",
                ))

        # 4. Find related tests
        affected_tests: list[RelatedTest] = []
        if include_tests:
            affected_tests = self._test_detector.find_related_tests(
                resolved, [i.file for i in impacts]
            )
            for test in affected_tests:
                if not any(i.file == test.file for i in impacts):
                    impacts.append(ImpactItem(
                        symbol=test.file, file=test.file, line=0,
                        severity=Severity.HIGH, reason=test.reason,
                    ))

        # 5. Filter, deduplicate, sort
        filtered = self._filter_by_severity(impacts, severity_threshold)
        deduped = self._deduplicate(filtered)
        deduped.sort(key=lambda i: self._SEVERITY_ORDER[i.severity])

        # 6. Recommendations
        recommendations = self._generate_recommendations(deduped, action, symbol_name)

        # 7. Build summary
        summary = self._build_summary(deduped)
        affected_files = len({i.file for i in deduped})
        elapsed_ms = int((time.time() - start_time) * 1000)

        return ImpactResult(
            symbol=symbol_name,
            action=action,
            blast_radius=BlastRadius(
                summary=summary,
                total_affected=len(deduped),
                affected_files=affected_files,
                affected_tests=len(affected_tests),
            ),
            impacts=deduped,
            affected_tests=affected_tests,
            recommendations=recommendations,
            metadata={
                "query_time_ms": elapsed_ms,
                "depth_searched": clamped_depth,
                "truncated": caller_result.metadata.truncated,
            },
        )

    def _classify_severity(self, depth: int, action: ImpactAction) -> Severity:
        if action == ImpactAction.DELETE:
            if depth <= 1:
                return Severity.CRITICAL
            if depth <= 2:
                return Severity.HIGH
            return Severity.MEDIUM
        if action == ImpactAction.RENAME and depth <= 1:
            return Severity.HIGH
        if depth == 1:
            return Severity.CRITICAL
        if depth == 2:
            return Severity.HIGH
        if depth == 3:
            return Severity.MEDIUM
        return Severity.LOW

    def _find_implementor_impacts(self, resolved: list[ResolvedSymbol], symbol_name: str) -> list[ImpactItem]:
        impacts: list[ImpactItem] = []
        for sym in resolved:
            if sym.kind != "method" or not sym.parent_symbol_id:
                continue
            cur = self._conn.execute(
                "SELECT kind, name FROM symbols WHERE id = ?", (sym.parent_symbol_id,)
            )
            parent = cur.fetchone()
            if not parent or parent[0] != "interface":
                continue

            cur2 = self._conn.execute(
                """SELECT DISTINCT s.name, f.relative_path, s.start_line
                   FROM relationships r
                   JOIN symbols s ON s.id = r.source_symbol_id
                   JOIN files f ON s.file_id = f.id
                   WHERE r.target_symbol = ? AND r.kind = 'implements'""",
                (parent[1],),
            )
            for row in cur2.fetchall():
                impacts.append(ImpactItem(
                    symbol=f"{row[0]}.{sym.name}",
                    file=row[1], line=row[2],
                    severity=Severity.CRITICAL,
                    reason=f"Implements {parent[1]}.{sym.name}",
                ))
        return impacts

    def _generate_recommendations(self, impacts: list[ImpactItem], action: ImpactAction, symbol: str) -> list[str]:
        recs: list[str] = []
        critical = [i for i in impacts if i.severity == Severity.CRITICAL]
        test_impacts = [i for i in impacts if self._test_detector.is_test_file(i.file)]

        if action == ImpactAction.DELETE and not impacts:
            recs.append(f'Safe to delete "{symbol}" - no references found')
        elif action == ImpactAction.DELETE and impacts:
            recs.append(f'Remove all {len(impacts)} references before deleting "{symbol}"')
        if action == ImpactAction.MODIFY and critical:
            recs.append(f"Update {len(critical)} direct callers if signature changes")
        if action == ImpactAction.RENAME:
            files = len({i.file for i in impacts})
            recs.append(f"Update references in {files} files with new name")
        if test_impacts:
            test_files = [t.file for t in test_impacts[:5]]
            recs.append(f"Run affected tests: {', '.join(test_files)}")
        if len(impacts) > 20:
            recs.append("Consider incremental refactoring to reduce blast radius")
        return recs

    def _filter_by_severity(self, impacts: list[ImpactItem], threshold: Severity) -> list[ImpactItem]:
        threshold_order = self._SEVERITY_ORDER[threshold]
        return [i for i in impacts if self._SEVERITY_ORDER[i.severity] <= threshold_order]

    @staticmethod
    def _deduplicate(impacts: list[ImpactItem]) -> list[ImpactItem]:
        seen: set[str] = set()
        result: list[ImpactItem] = []
        for i in impacts:
            key = f"{i.file}:{i.symbol}:{i.line}"
            if key not in seen:
                seen.add(key)
                result.append(i)
        return result

    @staticmethod
    def _build_summary(impacts: list[ImpactItem]) -> dict[str, int]:
        summary = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for i in impacts:
            summary[i.severity.value] += 1
        return summary

    @staticmethod
    def _empty_result(symbol_name: str, action: ImpactAction) -> ImpactResult:
        return ImpactResult(
            symbol=symbol_name,
            action=action,
            recommendations=[f'Symbol "{symbol_name}" not found in index'],
            metadata={"query_time_ms": 0, "depth_searched": 0, "truncated": False},
        )
