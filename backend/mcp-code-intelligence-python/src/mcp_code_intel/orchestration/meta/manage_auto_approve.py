"""manage_auto_approve meta-tool — add/remove tools from auto-approve list."""

from __future__ import annotations

import json
import sys
from pathlib import Path

MANAGE_AUTO_APPROVE_DEFINITION = {
    "name": "manage_auto_approve",
    "description": "Add or remove tools from the auto-approve list (persists across restarts).",
    "inputSchema": {
        "type": "object",
        "properties": {
            "tool_name": {"type": "string", "description": "Name of the tool to update"},
            "server_name": {"type": "string", "description": "Name of the server (if updating all tools of a server)"},
            "auto_approve": {"type": "boolean", "description": "Whether to add or remove from auto-approve list"},
        },
        "required": ["auto_approve"],
    },
}


def execute(args: dict, workspace: str) -> str:
    """Add or remove a tool/server from auto-approve list."""
    auto_approve = args.get("auto_approve")
    if not isinstance(auto_approve, bool):
        return json.dumps({"error": "Missing 'auto_approve' (boolean)"})
    tool_name = args.get("tool_name")
    server_name = args.get("server_name")
    if not tool_name and not server_name:
        return json.dumps({"error": "Provide 'tool_name' or 'server_name'"})
    target = tool_name or f"server:{server_name}"
    current = _load_list(workspace)
    if auto_approve:
        current.add(target)
    else:
        current.discard(target)
    _save_list(workspace, current)
    action = "added to" if auto_approve else "removed from"
    return json.dumps({"success": True, "message": f"'{target}' {action} auto-approve list"})


def _get_file(workspace: str) -> Path:
    dir_path = Path(workspace) / ".code-intel"
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path / "auto-approve.json"


def _load_list(workspace: str) -> set[str]:
    file_path = _get_file(workspace)
    if not file_path.exists():
        return set()
    try:
        return set(json.loads(file_path.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, OSError) as e:
        print(f"[auto-approve] Failed to read: {e}", file=sys.stderr)
        return set()


def _save_list(workspace: str, items: set[str]) -> None:
    file_path = _get_file(workspace)
    file_path.write_text(json.dumps(sorted(items)), encoding="utf-8")
