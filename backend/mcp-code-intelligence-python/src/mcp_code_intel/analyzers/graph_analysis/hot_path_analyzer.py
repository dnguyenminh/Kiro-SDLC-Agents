"""KSA-163: Hot Path Analyzer."""
from __future__ import annotations
from collections import deque
from . import HotPath, AdjacencyList
from .utils import GraphLoader


class HotPathAnalyzer:
    def __init__(self, graph_loader: GraphLoader) -> None:
        self._gl = graph_loader

    def analyze(self, module: str | None = None, limit: int = 20, min_callers: int = 2) -> list[HotPath]:
        rg = self._gl.load_reverse_call_graph(module)
        results = []
        for sid, callers in rg.items():
            if len(callers) < min_callers: continue
            tc = self._transitive_callers(sid, rg)
            info = self._gl.get_symbol_info(sid)
            if not info: continue
            results.append(HotPath(sid, info.name, info.file_path, len(callers), tc, info.kind))
        return sorted(results, key=lambda h: -h.transitive_callers)[:limit]

    def _transitive_callers(self, sid: int, rg: AdjacencyList) -> int:
        visited = {sid}
        queue: deque[int] = deque([sid])
        while queue:
            cur = queue.popleft()
            for c in rg.get(cur, []):
                if c not in visited:
                    visited.add(c); queue.append(c)
        return len(visited) - 1
