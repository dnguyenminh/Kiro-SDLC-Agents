"""
KSA-164: Reaching Definitions — Iterative dataflow algorithm.
Computes which definitions reach each basic block.
"""

from __future__ import annotations
from ..cfg.basic_block import BasicBlock
from ..cfg.control_flow_graph import ControlFlowGraph
from ..types import Definition


class ReachingDefinitions:
    def __init__(self) -> None:
        self._def_counter = 0

    def compute(self, cfg: ControlFlowGraph) -> dict[int, set[Definition]]:
        """Compute reaching definitions for all blocks in the CFG."""
        IN: dict[int, set[Definition]] = {}
        OUT: dict[int, set[Definition]] = {}

        # Initialize
        for block in cfg.blocks:
            IN[block.id] = set()
            OUT[block.id] = self._gen(block)

        # Iterate until fixed point
        changed = True
        iterations = 0
        MAX_ITERATIONS = 100

        while changed and iterations < MAX_ITERATIONS:
            changed = False
            iterations += 1

            for block in cfg.reverse_post_order():
                # IN[B] = union of OUT[P] for all predecessors P
                new_in: set[Definition] = set()
                for pred in cfg.get_predecessors(block):
                    pred_out = OUT.get(pred.id, set())
                    new_in.update(pred_out)
                IN[block.id] = new_in

                # OUT[B] = GEN[B] union (IN[B] - KILL[B])
                gen_set = self._gen(block)
                new_out = set(gen_set)
                for d in new_in:
                    if not self._kills(block, d):
                        new_out.add(d)

                old_out = OUT[block.id]
                if old_out != new_out:
                    OUT[block.id] = new_out
                    changed = True

        return IN

    def _gen(self, block: BasicBlock) -> set[Definition]:
        """GEN set: definitions created in this block."""
        defs: set[Definition] = set()
        for var_def in block.get_definitions():
            defs.add(Definition(
                variable=var_def.name,
                line=var_def.line,
                block_id=block.id,
                id=self._def_counter,
            ))
            self._def_counter += 1
        return defs

    def _kills(self, block: BasicBlock, defn: Definition) -> bool:
        """Check if a block kills a definition (redefines the same variable)."""
        block_defs = block.get_definitions()
        return any(d.name == defn.variable and d.block_id == block.id for d in block_defs)
