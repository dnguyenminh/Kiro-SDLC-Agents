"""Entry point — run with: python -m mcp_code_intel."""

import sys

from .config import load_config
from .server import McpServer


def main() -> None:
    """Start the MCP Code Intelligence server.

    Workspace is resolved from MCP initialize request roots[0].uri.
    Indexing is deferred until after initialize completes.
    """
    config = load_config()
    log("Server starting (workspace deferred until initialize)")

    server = McpServer(config)
    server.run()


def log(msg: str) -> None:
    """Log to stderr (stdout reserved for JSON-RPC)."""
    print(f"[code-intel] {msg}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
