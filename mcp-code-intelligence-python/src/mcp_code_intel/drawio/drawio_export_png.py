"""drawio_export_png MCP tool — Export .drawio file to PNG image.

Priority order for rendering:
1. draw.io CLI (drawio desktop app) — fastest, most accurate
2. Upstream MCP (chrome/puppeteer) — not available in Python server

If no renderer available, tool is NOT published.
"""

import json
import os
import platform
import shutil
import subprocess

DRAWIO_EXPORT_PNG_DEFINITION = {
    "name": "drawio_export_png",
    "description": "Export a .drawio diagram file to PNG image. "
    "Returns the relative path to the exported PNG file.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "Relative path to .drawio file (relative to workspace root)",
            },
        },
        "required": ["file_path"],
    },
}

_cached_cli_path: str | None = None
_cache_checked: bool = False


def _find_drawio_cli() -> str | None:
    """Find draw.io CLI executable on the system."""
    global _cached_cli_path, _cache_checked
    if _cache_checked:
        return _cached_cli_path
    _cache_checked = True

    # Check PATH first
    which_result = shutil.which("drawio")
    if which_result:
        _cached_cli_path = which_result
        return _cached_cli_path

    # Check known platform paths
    candidates = _get_platform_candidates()
    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            _cached_cli_path = candidate
            return _cached_cli_path

    _cached_cli_path = None
    return None


def _get_platform_candidates() -> list[str]:
    """Get known draw.io CLI paths for current platform."""
    system = platform.system()
    if system == "Windows":
        local = os.environ.get("LOCALAPPDATA", "")
        prog = os.environ.get("PROGRAMFILES", "")
        return [
            r"C:\Program Files\draw.io\draw.io.exe",
            os.path.join(local, r"Programs\draw.io\draw.io.exe") if local else "",
            os.path.join(prog, r"draw.io\draw.io.exe") if prog else "",
        ]
    elif system == "Darwin":
        home = os.environ.get("HOME", "")
        return [
            "/Applications/draw.io.app/Contents/MacOS/draw.io",
            "/usr/local/bin/drawio",
            os.path.join(home, "Applications/draw.io.app/Contents/MacOS/draw.io") if home else "",
        ]
    else:  # Linux
        home = os.environ.get("HOME", "")
        return [
            "/usr/bin/drawio",
            "/usr/local/bin/drawio",
            "/snap/bin/drawio",
            os.path.join(home, ".local/bin/drawio") if home else "",
        ]


def is_export_png_available() -> bool:
    """Check if at least one renderer is available."""
    return _find_drawio_cli() is not None


def handle_drawio_export_png(args: dict, workspace: str) -> str:
    """MCP tool handler — export .drawio to PNG."""
    raw_path = args.get("file_path")
    if not raw_path:
        return _error("file_path is required")

    file_path = raw_path if os.path.isabs(raw_path) else os.path.join(workspace, raw_path)
    if not os.path.exists(file_path):
        return _error(f"File not found: {raw_path}")
    if not file_path.endswith(".drawio"):
        return _error("File must have .drawio extension")

    png_path = file_path.replace(".drawio", ".png")
    relative_png = os.path.relpath(png_path, workspace).replace("\\", "/")

    cli_path = _find_drawio_cli()
    if not cli_path:
        return _error(
            "No renderer available. Install draw.io desktop app. "
            "Upstream MCP (chrome/puppeteer) not available in Python server."
        )

    try:
        _export_with_cli(cli_path, file_path, png_path)
    except Exception as e:
        return _error(f"Export failed: {e}")

    if not os.path.exists(png_path):
        return _error(f"Export failed — PNG file was not created at {relative_png}")

    size_bytes = os.path.getsize(png_path)
    return json.dumps({
        "success": True,
        "file_path": relative_png,
        "size_bytes": size_bytes,
        "renderer": "drawio-cli",
    })


def _export_with_cli(cli_path: str, input_path: str, output_path: str) -> None:
    """Export using draw.io CLI."""
    cmd = [cli_path, "--export", "--format", "png", "--border", "10",
           "--output", output_path, input_path]
    subprocess.run(cmd, timeout=30, capture_output=True, check=True)


def _error(msg: str) -> str:
    return json.dumps({"success": False, "error": msg})
