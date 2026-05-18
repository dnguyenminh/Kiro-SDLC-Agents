"""Port conflict bug fix tests — ViewerServer port release on shutdown.

Bug: When MCP server is reconnected, old instance doesn't release the HTTP
viewer port, causing "port already in use" error.

Fix: ViewerServer.stop() calls HTTPServer.shutdown() which releases the port.
McpServer._shutdown() calls self._viewer.stop() on stdin close + SIGTERM/SIGINT.
"""

import socket
import sys
import time
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from mcp_code_intel.http.viewer_server import ViewerServer


def _find_free_port() -> int:
    """Find an available port for testing."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _is_port_in_use(port: int) -> bool:
    """Check if a port is currently bound."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


def test_viewer_stop_releases_port():
    """Unit test: ViewerServer.stop() closes HTTP server and releases port."""
    port = _find_free_port()
    server = ViewerServer(port, ".")
    server.start()
    time.sleep(0.3)

    # Port should be in use
    assert _is_port_in_use(port), f"Port {port} should be bound after start()"

    # Stop should release port
    server.stop()
    time.sleep(0.3)

    assert not _is_port_in_use(port), f"Port {port} should be free after stop()"


def test_start_stop_start_same_port():
    """Reconnect simulation: start → stop → start new instance on same port."""
    port = _find_free_port()

    # First instance
    server1 = ViewerServer(port, ".")
    server1.start()
    time.sleep(0.3)
    assert _is_port_in_use(port)

    # Simulate stdin close → shutdown
    server1.stop()
    time.sleep(0.3)
    assert not _is_port_in_use(port)

    # Second instance on same port — should succeed (no "port in use" error)
    server2 = ViewerServer(port, ".")
    server2.start()
    time.sleep(0.3)
    assert _is_port_in_use(port), "Second instance should bind same port"

    # Cleanup
    server2.stop()
    time.sleep(0.3)
    assert not _is_port_in_use(port)


def test_stop_idempotent():
    """Calling stop() multiple times should not raise errors."""
    port = _find_free_port()
    server = ViewerServer(port, ".")
    server.start()
    time.sleep(0.3)

    server.stop()
    server.stop()  # Should not raise
    server.stop()  # Should not raise


def test_stop_without_start():
    """Calling stop() before start() should not raise errors."""
    port = _find_free_port()
    server = ViewerServer(port, ".")
    server.stop()  # Should not raise — _server is None


if __name__ == "__main__":
    print("Running port conflict tests...")
    test_viewer_stop_releases_port()
    print("  PASS: test_viewer_stop_releases_port")
    test_start_stop_start_same_port()
    print("  PASS: test_start_stop_start_same_port")
    test_stop_idempotent()
    print("  PASS: test_stop_idempotent")
    test_stop_without_start()
    print("  PASS: test_stop_without_start")
    print("\n4 passed, 0 failed")
