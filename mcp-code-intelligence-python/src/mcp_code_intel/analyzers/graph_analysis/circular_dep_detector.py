"""KSA-163: Circular Dependency Detector."""
from __future__ import annotations
from . import CircularDep, CycleChain, CycleNode, AdjacencyList
from .utils import GraphLoader, TarjanSCC


class CircularDepDetector:
    def __init__(self, graph_loader: GraphLoader) -> None:
        self._gl = graph_loader

    def detect(self, module: str | None = None, max_length: int | None = None) -> list[CircularDep]:
        graph = self._gl.load_dependency_graph(module)
        if not graph:
            return []
        sccs = TarjanSCC().find_sccs(graph)
        results = []
        for scc in sccs:
            if max_length and len(scc) > max_length:
                continue
            results.append(self._build(scc, graph, module))
        sev_order = {"high": 0, "medium": 1, "low": 2}
        return sorted(results, key=lambda d: (sev_order.get(d.severity, 3), d.length))

    def _build(self, scc: list[int], graph: AdjacencyList, module: str | None) -> CircularDep:
        infos = self._gl.get_symbol_info_batch(scc)
        scc_set = set(scc)
        ordered = self._order_cycle(scc, graph, scc_set)
        nodes = [CycleNode(id, infos.get(id, None) and infos[id].name or f"sym_{id}",
                           infos.get(id, None) and infos[id].file_path or "unknown",
                           infos.get(id, None) and infos[id].kind or "unknown") for id in ordered]
        edges = [f"{infos.get(ordered[i], None) and infos[ordered[i]].name or ordered[i]} → "
                 f"{infos.get(ordered[(i+1)%len(ordered)], None) and infos[ordered[(i+1)%len(ordered)]].name or ordered[(i+1)%len(ordered)]}"
                 for i in range(len(ordered))]
        severity = "high" if len(scc) <= 2 else "medium" if len(scc) <= 4 else "low"
        return CircularDep(CycleChain(nodes, edges), len(scc), severity, module)

    def _order_cycle(self, scc: list[int], graph: AdjacencyList, scc_set: set[int]) -> list[int]:
        visited: set[int] = set()
        ordered: list[int] = []
        current = scc[0]
        while current not in visited:
            visited.add(current); ordered.append(current)
            nxt = next((n for n in graph.get(current, []) if n in scc_set and n not in visited), None)
            if nxt is None: break
            current = nxt
        return ordered if len(ordered) == len(scc) else scc
