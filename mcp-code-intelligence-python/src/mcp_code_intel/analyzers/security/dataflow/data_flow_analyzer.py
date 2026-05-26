"""
KSA-164: Data Flow Analyzer — Computes def-use chains from CFG + reaching definitions.
"""

from __future__ import annotations
from ..cfg.control_flow_graph import ControlFlowGraph
from .reaching_definitions import ReachingDefinitions
from ..types import DataFlowResult, DefUseChain, Definition


class DataFlowAnalyzer:
    def __init__(self) -> None:
        self._reaching_defs = ReachingDefinitions()

    def analyze(self, cfg: ControlFlowGraph) -> DataFlowResult:
        """Analyze data flow for a control flow graph."""
        reaching = self._reaching_defs.compute(cfg)
        all_defs = self._collect_all_definitions(cfg)
        chains = self._build_def_use_chains(cfg, reaching, all_defs)

        return DataFlowResult(
            reaching_defs=reaching,
            def_use_chains=chains,
            definitions=all_defs,
        )

    def _collect_all_definitions(self, cfg: ControlFlowGraph) -> list[Definition]:
        defs: list[Definition] = []
        def_id = 0
        for block in cfg.blocks:
            for var_def in block.get_definitions():
                defs.append(Definition(
                    variable=var_def.name,
                    line=var_def.line,
                    block_id=block.id,
                    id=def_id,
                ))
                def_id += 1
        return defs

    def _build_def_use_chains(
        self,
        cfg: ControlFlowGraph,
        reaching: dict[int, set[Definition]],
        all_defs: list[Definition],
    ) -> list[DefUseChain]:
        chains: list[DefUseChain] = []

        for defn in all_defs:
            uses: list[dict] = []

            for block in cfg.blocks:
                reaching_here = reaching.get(block.id, set())

                # Check if this definition reaches this block
                reaches = any(
                    d.variable == defn.variable and d.line == defn.line and d.block_id == defn.block_id
                    for d in reaching_here
                )
                if not reaches:
                    continue

                # Find uses of this variable in the block
                for use in block.get_uses():
                    if use.name == defn.variable:
                        uses.append({"line": use.line, "block_id": block.id})

            if uses:
                chains.append(DefUseChain(definition=defn, uses=uses))

        return chains
