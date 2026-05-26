"""
KSA-164: Control Flow Graph — Container for basic blocks and edges.
"""

from __future__ import annotations
from typing import Optional
from .basic_block import BasicBlock
from .cfg_edge import CFGEdge


class ControlFlowGraph:
    def __init__(self, entry: BasicBlock) -> None:
        self.entry = entry
        self.exits: list[BasicBlock] = []
        self.blocks: list[BasicBlock] = []
        self.edges: list[CFGEdge] = []
        self._adjacency: dict[int, list[CFGEdge]] = {}
        self._reverse_adj: dict[int, list[CFGEdge]] = {}
        self.add_block(entry)

    def add_block(self, block: BasicBlock) -> None:
        self.blocks.append(block)
        self._adjacency[block.id] = []
        self._reverse_adj[block.id] = []
        if block.type == "exit":
            self.exits.append(block)

    def add_edge(self, from_block: BasicBlock, to_block: BasicBlock, edge_type: str, label: Optional[str] = None) -> CFGEdge:
        edge = CFGEdge(from_block, to_block, edge_type, label)
        self.edges.append(edge)
        self._adjacency[from_block.id].append(edge)
        self._reverse_adj[to_block.id].append(edge)
        return edge

    def get_successors(self, block: BasicBlock) -> list[BasicBlock]:
        return [e.to_block for e in self._adjacency.get(block.id, [])]

    def get_predecessors(self, block: BasicBlock) -> list[BasicBlock]:
        return [e.from_block for e in self._reverse_adj.get(block.id, [])]

    def get_out_edges(self, block: BasicBlock) -> list[CFGEdge]:
        return self._adjacency.get(block.id, [])

    def get_in_edges(self, block: BasicBlock) -> list[CFGEdge]:
        return self._reverse_adj.get(block.id, [])

    def topological_order(self) -> list[BasicBlock]:
        visited: set[int] = set()
        result: list[BasicBlock] = []

        def dfs(block: BasicBlock) -> None:
            if block.id in visited:
                return
            visited.add(block.id)
            for succ in self.get_successors(block):
                dfs(succ)
            result.insert(0, block)

        dfs(self.entry)
        return result

    def reverse_post_order(self) -> list[BasicBlock]:
        visited: set[int] = set()
        post_order: list[BasicBlock] = []

        def dfs(block: BasicBlock) -> None:
            if block.id in visited:
                return
            visited.add(block.id)
            for succ in self.get_successors(block):
                dfs(succ)
            post_order.append(block)

        dfs(self.entry)
        return list(reversed(post_order))

    def get_block(self, block_id: int) -> Optional[BasicBlock]:
        for b in self.blocks:
            if b.id == block_id:
                return b
        return None

    def __str__(self) -> str:
        lines = [f"CFG: {len(self.blocks)} blocks, {len(self.edges)} edges"]
        for edge in self.edges:
            lines.append(f"  {edge}")
        return "\n".join(lines)
