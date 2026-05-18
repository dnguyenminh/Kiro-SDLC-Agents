"""JSON-RPC 2.0 over stdio pipes — sends requests to child process stdin,
reads responses from child process stdout.

Behavioral parity with Kotlin StdioJsonRpc.kt.
"""

from __future__ import annotations

import asyncio
import json
import sys
from typing import Any


class StdioJsonRpc:
    """JSON-RPC 2.0 client over stdin/stdout pipes of a child process."""

    def __init__(self) -> None:
        self._next_id = 1
        self._pending: dict[int, asyncio.Future[Any]] = {}
        self._proc: asyncio.subprocess.Process | None = None
        self._reader_task: asyncio.Task | None = None

    def attach(self, proc: asyncio.subprocess.Process) -> None:
        """Attach to a child process's stdin/stdout. Starts reader task."""
        self._proc = proc
        self._reader_task = asyncio.create_task(self._read_loop())

    def detach(self) -> None:
        """Detach from process — cancel reader, reject pending."""
        if self._reader_task:
            self._reader_task.cancel()
            self._reader_task = None
        self._proc = None
        self.reject_all("Connection closed")

    async def send_request(self, method: str, params: dict | None, timeout_ms: int) -> Any:
        """Send JSON-RPC request and await response with timeout."""
        req_id = self._next_id
        self._next_id += 1
        future: asyncio.Future[Any] = asyncio.get_event_loop().create_future()
        self._pending[req_id] = future
        msg = self._build_request(req_id, method, params)
        self._write_message(msg)
        try:
            return await asyncio.wait_for(future, timeout=timeout_ms / 1000.0)
        except asyncio.TimeoutError:
            self._pending.pop(req_id, None)
            raise RuntimeError(f"Timeout after {timeout_ms}ms waiting for {method}")

    def send_notification(self, method: str, params: dict | None) -> None:
        """Send JSON-RPC notification (no response expected)."""
        msg = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            msg["params"] = params
        self._write_message(msg)

    def reject_all(self, reason: str) -> None:
        """Reject all pending requests with an error."""
        for future in self._pending.values():
            if not future.done():
                future.set_exception(RuntimeError(reason))
        self._pending.clear()

    async def _read_loop(self) -> None:
        """Read lines from child stdout and resolve pending requests."""
        proc = self._proc
        if not proc or not proc.stdout:
            return
        try:
            while True:
                line = await proc.stdout.readline()
                if not line:
                    break
                self._handle_incoming(line.decode("utf-8").strip())
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[StdioJsonRpc] Read error: {e}", file=sys.stderr)

    def _handle_incoming(self, line: str) -> None:
        """Parse incoming JSON-RPC message and resolve or notify."""
        if not line:
            return
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            return
        req_id = msg.get("id")
        if req_id is not None:
            self._resolve_response(req_id, msg)

    def _resolve_response(self, req_id: int, response: dict) -> None:
        """Resolve a pending future with the response result or error."""
        future = self._pending.pop(req_id, None)
        if future is None or future.done():
            return
        error = response.get("error")
        if error:
            future.set_exception(RuntimeError(error.get("message", "Unknown error")))
        else:
            future.set_result(response.get("result"))

    def _build_request(self, req_id: int, method: str, params: dict | None) -> dict:
        """Build a JSON-RPC request object."""
        msg: dict[str, Any] = {"jsonrpc": "2.0", "id": req_id, "method": method}
        if params is not None:
            msg["params"] = params
        return msg

    def _write_message(self, msg: dict) -> None:
        """Write JSON message to child process stdin."""
        proc = self._proc
        if not proc or not proc.stdin:
            raise RuntimeError("Not attached to process")
        data = (json.dumps(msg) + "\n").encode("utf-8")
        proc.stdin.write(data)
