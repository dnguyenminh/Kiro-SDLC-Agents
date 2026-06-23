"""
KSA-164: CFG Edge — Represents control flow between basic blocks.
"""

from __future__ import annotations
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .basic_block import BasicBlock


class CFGEdge:
    __slots__ = ("from_block", "to_block", "type", "label")

    def __init__(self, from_block: BasicBlock, to_block: BasicBlock, edge_type: str, label: Optional[str] = None):
        self.from_block = from_block
        self.to_block = to_block
        self.type = edge_type
        self.label = label

    def __str__(self) -> str:
        return f"B{self.from_block.id} -[{self.type}]-> B{self.to_block.id}"
