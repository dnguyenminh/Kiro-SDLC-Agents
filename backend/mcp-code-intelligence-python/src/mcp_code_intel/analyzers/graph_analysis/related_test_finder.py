"""KSA-163: Related Test Finder."""
from __future__ import annotations
from collections import deque
from . import RelatedTestResult, TestReference, SymbolRef, AdjacencyList
from .utils import GraphLoader, TestFileDetector


class RelatedTestFinder:
    def __init__(self, graph_loader: GraphLoader) -> None:
        self._gl = graph_loader
        self._td = TestFileDetector()

    def find(self, symbol_name: str, max_depth: int = 3, file_path: str | None = None) -> RelatedTestResult | None:
        sid = self._gl.resolve_symbol_id(symbol_name, file_path)
        if sid is None: return None
        info = self._gl.get_symbol_info(sid)
        if not info: return None
        reverse_graph = self._gl.load_reverse_call_graph()
        callers = self._reverse_bfs(sid, reverse_graph, max_depth)
        direct, indirect = [], []
        for cid, depth, path_ids in callers:
            ci = self._gl.get_symbol_info(cid)
            if not ci: continue
            if not (self._td.is_test_file(ci.file_path) or self._td.is_test_function(ci.name)):
                continue
            ref = TestReference(cid, ci.name, ci.file_path, depth,
                                [ci.name] + [self._gl.get_symbol_info(p).name if self._gl.get_symbol_info(p) else str(p) for p in path_ids])
            (direct if depth == 1 else indirect).append(ref)
        return RelatedTestResult(SymbolRef(sid, info.name, info.file_path), direct, indirect, len(direct) + len(indirect))

    def _reverse_bfs(self, start: int, rg: AdjacencyList, max_depth: int) -> list[tuple[int, int, list[int]]]:
        visited = {start}
        queue: deque[tuple[int, int, list[int]]] = deque([(start, 0, [])])
        results = []
        while queue:
            nid, depth, path = queue.popleft()
            if depth > max_depth: continue
            for caller in rg.get(nid, []):
                if caller in visited: continue
                visited.add(caller)
                new_path = path + [nid]
                results.append((caller, depth + 1, new_path))
                queue.append((caller, depth + 1, new_path))
        return results
