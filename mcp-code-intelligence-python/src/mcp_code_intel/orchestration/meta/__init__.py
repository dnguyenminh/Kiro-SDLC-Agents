"""Orchestration meta-tools module."""

from .dispatcher import MetaToolDispatcher, META_TOOL_DEFINITIONS
from .agent_log import execute as agent_log_execute, AGENT_LOG_DEFINITION
from .manage_auto_approve import execute as manage_auto_approve_execute, MANAGE_AUTO_APPROVE_DEFINITION
from .recursion_guard import parse_recursion_args, is_depth_exceeded, child_depth_args, RecursionState

__all__ = [
    "MetaToolDispatcher",
    "META_TOOL_DEFINITIONS",
    "agent_log_execute",
    "AGENT_LOG_DEFINITION",
    "manage_auto_approve_execute",
    "MANAGE_AUTO_APPROVE_DEFINITION",
    "parse_recursion_args",
    "is_depth_exceeded",
    "child_depth_args",
    "RecursionState",
]
