"""stream_write_file tool — writes content directly to local disk."""

import json
import os
from pathlib import Path
from typing import Any


def handle_stream_write_file(params: dict[str, Any], workspace: str) -> str:
    """Handle stream_write_file tool invocation."""
    raw_path = params.get("file_path", "")
    mode = params.get("mode", "write")
    content = params.get("content", "")
    encoding = params.get("encoding", "utf-8")

    if not raw_path:
        return json.dumps({"error": "file_path is required"})

    file_path = Path(raw_path) if os.path.isabs(raw_path) else Path(workspace) / raw_path
    file_path.parent.mkdir(parents=True, exist_ok=True)

    file_exists = file_path.exists()
    size_before = file_path.stat().st_size if file_exists else 0

    if file_exists and content == "":
        return json.dumps({
            "file_path": str(file_path),
            "bytes_written": 0,
            "total_size": size_before,
            "file_size_before": size_before,
            "mode": "no-op",
            "message": "File exists, no content provided",
        })

    if mode == "create" and file_exists:
        return json.dumps({
            "file_path": str(file_path),
            "bytes_written": 0,
            "total_size": size_before,
            "file_size_before": size_before,
            "mode": "error",
            "message": "File already exists",
        })

    if mode == "append" and file_exists:
        file_path.open("a", encoding=encoding).write(content)
    else:
        file_path.write_text(content, encoding=encoding)

    total_size = file_path.stat().st_size
    return json.dumps({
        "file_path": str(file_path),
        "bytes_written": total_size - size_before,
        "total_size": total_size,
        "file_size_before": size_before,
        "mode": mode,
    })
