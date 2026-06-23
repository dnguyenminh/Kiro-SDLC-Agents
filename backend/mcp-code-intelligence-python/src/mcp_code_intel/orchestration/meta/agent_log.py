"""agent_log meta-tool — logs agent activity to .code-intel/agent-log.jsonl."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

AGENT_LOG_DEFINITION = {
    "name": "agent_log",
    "description": "Write an execution log entry for agent activity tracking.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "ticket_key": {"type": "string", "description": "Jira ticket key (e.g. MTO-12)"},
            "agent_name": {"type": "string", "description": "Agent: SM, BA, TA, SA, QA, DEV, DEVOPS"},
            "step": {"type": "string", "description": "Step ID (e.g. Step-1, Self-Check)"},
            "status": {"type": "string", "description": "START|DONE|ARTIFACT|SKIP|ERROR|WARN|VERIFY"},
            "message": {"type": "string", "description": "What happened"},
            "artifacts": {"type": "string", "description": "Optional JSON of artifact paths"},
        },
        "required": ["ticket_key", "agent_name", "step", "status", "message"],
    },
}


def execute(args: dict, workspace: str) -> str:
    """Append agent log entry to jsonl file."""
    ticket_key = args.get("ticket_key", "")
    agent_name = args.get("agent_name", "")
    step = args.get("step", "")
    status = args.get("status", "")
    message = args.get("message", "")
    artifacts = args.get("artifacts")

    if not ticket_key or not agent_name or not status:
        return json.dumps({"error": "ticket_key, agent_name, status are required"})

    entry: dict = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ticket_key": ticket_key,
        "agent_name": agent_name,
        "step": step,
        "status": status,
        "message": message,
    }
    if artifacts:
        entry["artifacts"] = artifacts

    log_dir = Path(workspace) / ".code-intel"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "agent-log.jsonl"
    with log_file.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")

    return json.dumps({"success": True, "logged": f"{ticket_key}/{agent_name}/{step}/{status}"})
