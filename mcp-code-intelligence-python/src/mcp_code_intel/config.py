"""Configuration loading — environment variables and config file.

Workspace resolution priority:
1. --workspace CLI arg (highest — Kiro resolves ${workspaceFolder})
2. CODE_INTEL_WORKSPACE env var
3. initialize.roots[0].uri (MCP protocol)
4. cwd() (lowest fallback)
"""

import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, unquote

DEFAULT_EXCLUDE = [
    "node_modules", ".git", "dist", "build", ".gradle",
    ".idea", ".vscode", "__pycache__", ".venv", "target",
    ".code-intel", "coverage", ".next", ".nuxt",
]

DEFAULT_EXTENSIONS = [
    ".ts", ".tsx", ".js", ".jsx", ".kt", ".java", ".py",
    ".go", ".rs", ".c", ".cpp", ".h", ".hpp", ".cs",
    ".rb", ".php", ".swift", ".scala", ".sql", ".sh",
    ".yaml", ".yml", ".json", ".toml",
]


def load_config() -> dict[str, Any]:
    """Load initial config — checks CLI args, env, then cwd."""
    workspace = _resolve_workspace_from_cli() or _resolve_workspace_from_env()
    return _build_config(workspace)


def set_workspace(config: dict[str, Any], root_uri: str | None) -> dict[str, Any]:
    """Set workspace from MCP initialize roots (only if CLI/env not already set)."""
    # CLI arg and env var take priority over initialize roots
    if _resolve_workspace_from_cli() or os.environ.get("CODE_INTEL_WORKSPACE"):
        return config
    workspace = _resolve_workspace_from_roots(root_uri)
    return _build_config(workspace)


def file_uri_to_path(uri: str) -> str:
    """Convert a file:// URI to a local filesystem path."""
    parsed = urlparse(uri)
    path_str = unquote(parsed.path)
    # On Windows, file:///C:/path → remove leading slash
    if len(path_str) >= 3 and path_str[0] == '/' and path_str[2] == ':':
        path_str = path_str[1:]
    return path_str


def _resolve_workspace_from_cli() -> str | None:
    """Resolve workspace from --workspace CLI argument."""
    import sys
    args = sys.argv[1:]
    if '--workspace' in args:
        idx = args.index('--workspace')
        if idx + 1 < len(args):
            return str(Path(args[idx + 1]).resolve())
    return None


def _resolve_workspace_from_env() -> str:
    """Resolve workspace from env var or cwd."""
    env_ws = os.environ.get("CODE_INTEL_WORKSPACE")
    if env_ws:
        return str(Path(env_ws).resolve())
    return str(Path.cwd())


def _resolve_workspace_from_roots(root_uri: str | None) -> str:
    """Resolve workspace from initialize roots, with env override."""
    # Env var always takes priority (backward compat)
    env_ws = os.environ.get("CODE_INTEL_WORKSPACE")
    if env_ws:
        return str(Path(env_ws).resolve())
    if root_uri:
        return str(Path(file_uri_to_path(root_uri)).resolve())
    return str(Path.cwd())


def _build_config(workspace: str) -> dict[str, Any]:
    """Build full config dict from workspace path."""
    code_intel_dir = Path(workspace) / ".code-intel"
    config_path = code_intel_dir / "config.json"
    file_cfg = _load_file_config(config_path)

    return {
        "workspace": workspace,
        "db_path": str(code_intel_dir / "index.db"),
        "config_path": str(config_path),
        "viewer_port": _env_int("CODE_INTEL_VIEWER_PORT", file_cfg.get("viewerPort", 3201)),
        "watch_enabled": _env_bool("CODE_INTEL_WATCH", file_cfg.get("watchEnabled", True)),
        "watch_debounce_ms": _env_int("CODE_INTEL_DEBOUNCE", file_cfg.get("watchDebounceMs", 500)),
        "ollama_url": os.environ.get("OLLAMA_URL", file_cfg.get("ollamaUrl")),
        "ollama_model": os.environ.get("OLLAMA_MODEL", file_cfg.get("ollamaModel", "nomic-embed-text")),
        "exclude_patterns": file_cfg.get("excludePatterns", DEFAULT_EXCLUDE),
        "include_extensions": file_cfg.get("includeExtensions", DEFAULT_EXTENSIONS),
        "max_file_size": file_cfg.get("maxFileSize", 512_000),
    }


def _load_file_config(config_path: Path) -> dict[str, Any]:
    """Load JSON config file if it exists."""
    try:
        if config_path.exists():
            return json.loads(config_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        import sys
        print(f"[config] Failed to read {config_path}: {e}", file=sys.stderr)
    return {}


def _env_bool(key: str, fallback: bool) -> bool:
    """Read boolean from environment variable."""
    val = os.environ.get(key)
    if val is None:
        return fallback
    return val in ("1", "true", "True")


def _env_int(key: str, fallback: int) -> int:
    """Read integer from environment variable."""
    val = os.environ.get(key)
    if val is None:
        return fallback
    try:
        return int(val)
    except ValueError:
        return fallback
