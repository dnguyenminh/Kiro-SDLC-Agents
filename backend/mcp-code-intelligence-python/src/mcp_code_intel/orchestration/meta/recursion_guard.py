"""Max recursion depth guard — prevents infinite orchestrator loops."""

from __future__ import annotations

import sys
from dataclasses import dataclass


@dataclass
class RecursionState:
    """Tracks current and max recursion depth."""

    current_depth: int = 0
    max_depth: int = 5


def parse_recursion_args(args: list[str] | None = None) -> RecursionState:
    """Parse recursion depth from CLI args."""
    if args is None:
        args = sys.argv[1:]
    current_depth = 0
    max_depth = 5
    if "--depth" in args:
        idx = args.index("--depth")
        if idx + 1 < len(args):
            try:
                current_depth = int(args[idx + 1])
            except ValueError:
                pass
    if "--max-depth" in args:
        idx = args.index("--max-depth")
        if idx + 1 < len(args):
            try:
                max_depth = int(args[idx + 1])
            except ValueError:
                pass
    return RecursionState(current_depth=current_depth, max_depth=max_depth)


def is_depth_exceeded(state: RecursionState) -> bool:
    """Check if orchestration should be disabled due to depth limit."""
    return state.current_depth >= state.max_depth


def child_depth_args(state: RecursionState) -> list[str]:
    """Get child depth args for spawning child servers."""
    return ["--depth", str(state.current_depth + 1), "--max-depth", str(state.max_depth)]
