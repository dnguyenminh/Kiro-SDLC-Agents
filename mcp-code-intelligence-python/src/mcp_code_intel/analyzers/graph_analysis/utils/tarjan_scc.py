"""KSA-163: Tarjan's SCC algorithm."""
from __future__ import annotations
from .. import AdjacencyList


class TarjanSCC:
    def find_sccs(self, graph: AdjacencyList) -> list[list[int]]:
        self._index = 0
        self._stack: list[int] = []
        self._indices: dict[int, int] = {}
        self._lowlinks: dict[int, int] = {}
        self._on_stack: set[int] = set()
        self._sccs: list[list[int]] = []

        for node in graph:
            if node not in self._indices:
                self._strong_connect(node, graph)
        return [scc for scc in self._sccs if len(scc) > 1]

    def _strong_connect(self, v: int, graph: AdjacencyList) -> None:
        self._indices[v] = self._index
        self._lowlinks[v] = self._index
        self._index += 1
        self._stack.append(v)
        self._on_stack.add(v)

        for w in graph.get(v, []):
            if w not in self._indices:
                self._strong_connect(w, graph)
                self._lowlinks[v] = min(self._lowlinks[v], self._lowlinks[w])
            elif w in self._on_stack:
                self._lowlinks[v] = min(self._lowlinks[v], self._indices[w])

        if self._lowlinks[v] == self._indices[v]:
            scc: list[int] = []
            while True:
                w = self._stack.pop()
                self._on_stack.discard(w)
                scc.append(w)
                if w == v:
                    break
            self._sccs.append(scc)
