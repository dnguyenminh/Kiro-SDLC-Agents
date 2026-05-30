"""KSA-162: HTTP Handler Detector."""
from __future__ import annotations
import re
from .. import EntryPoint, EntryType, Confidence, SymbolInput
from ..pattern_registry import PatternRegistry
from ..route_resolver import RouteResolver


class HTTPHandlerDetector:
    def __init__(self, registry: PatternRegistry) -> None:
        self._registry = registry
        self._resolver = RouteResolver()

    def detect_from_symbols(self, symbols: list[SymbolInput], framework: str, source: str) -> list[EntryPoint]:
        patterns = self._registry.get_framework(framework)
        if not patterns:
            return []
        prefix = self._find_controller_prefix(symbols, patterns)
        results = []
        for sym in symbols:
            ep = self._detect_handler(sym, framework, patterns, prefix, source)
            if ep:
                results.append(ep)
        return results

    def _detect_handler(self, sym, framework, patterns, prefix, source) -> EntryPoint | None:
        decorators = sym.decorators or []
        if patterns.decorators:
            for hp in patterns.decorators.get("handler", []):
                match = next((d for d in decorators if hp in d), None)
                if match:
                    method, path = self._extract_method_and_path(match, hp)
                    full = self._resolver.resolve(prefix, path)
                    has_auth = any(ind in d for d in decorators for ind in patterns.auth_indicators)
                    return EntryPoint(
                        symbol_id=sym.id, symbol_name=sym.name,
                        file_path=sym.file_path, start_line=sym.start_line,
                        entry_type=EntryType.HTTP_HANDLER, framework=framework,
                        http_method=method, route_path=path,
                        full_route=self._resolver.normalize_params(full),
                        has_auth=has_auth, controller=sym.parent_name,
                        confidence=Confidence.High,
                    )
        if patterns.call_patterns:
            ctx = self._get_context(source, sym.start_line)
            for hp in patterns.call_patterns.get("handler", []):
                if hp in ctx:
                    method = self._method_from_call(hp)
                    path = self._path_from_context(ctx, hp)
                    full = self._resolver.resolve(prefix, path)
                    return EntryPoint(
                        symbol_id=sym.id, symbol_name=sym.name,
                        file_path=sym.file_path, start_line=sym.start_line,
                        entry_type=EntryType.HTTP_HANDLER, framework=framework,
                        http_method=method, route_path=path,
                        full_route=self._resolver.normalize_params(full),
                        confidence=Confidence.Medium,
                    )
        return None

    def _find_controller_prefix(self, symbols, patterns) -> str | None:
        prefixes = (patterns.decorators or {}).get("prefix", [])
        for p in prefixes:
            for sym in symbols:
                match = next((d for d in (sym.decorators or []) if p in d), None)
                if match:
                    return self._extract_path_arg(match)
        return None

    def _extract_method_and_path(self, decorator: str, pattern: str) -> tuple[str, str]:
        lower = pattern.lower()
        method = "POST" if "post" in lower else "PUT" if "put" in lower else \
                 "DELETE" if "delete" in lower else "PATCH" if "patch" in lower else "GET"
        return method, self._extract_path_arg(decorator)

    def _extract_path_arg(self, text: str) -> str:
        m = re.search(r"""['"` ]([^'"`]+)['"` ]""", text)
        return self._resolver.extract_path_from_arg(m.group(1)) if m else "/"

    def _method_from_call(self, pattern: str) -> str:
        p = pattern.lower()
        if "post" in p: return "POST"
        if "put" in p: return "PUT"
        if "delete" in p: return "DELETE"
        if "patch" in p: return "PATCH"
        return "GET"

    def _path_from_context(self, ctx: str, pattern: str) -> str:
        idx = ctx.find(pattern)
        if idx == -1: return "/"
        after = ctx[idx + len(pattern):]
        m = re.search(r"""['"`]([^'"`]*)['"`]""", after)
        return self._resolver.extract_path_from_arg(m.group(1)) if m else "/"

    def _get_context(self, source: str, start_line: int) -> str:
        lines = source.split("\n")
        s = max(0, start_line - 3)
        e = min(len(lines), start_line + 5)
        return "\n".join(lines[s:e])
