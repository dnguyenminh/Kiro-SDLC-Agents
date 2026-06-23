"""Integration test — full index + query cycle."""

import os
import sys
import tempfile
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from mcp_code_intel.config import load_config, set_workspace
from mcp_code_intel.db import DatabaseManager
from mcp_code_intel.indexer import IndexingEngine
from mcp_code_intel.query import QueryLayer
from mcp_code_intel.tools import (
    handle_code_search,
    handle_code_symbols,
    handle_code_modules,
    handle_code_index_status,
    handle_code_context,
)


def test_full_cycle():
    """Test full index + query cycle."""
    tmp = tempfile.mkdtemp()
    try:
        # Create sample files
        src_dir = Path(tmp) / "src"
        src_dir.mkdir()
        (src_dir / "hello.py").write_text(
            "class HelloService:\n    def greet(self, name):\n        return f'Hello {name}'\n"
        )
        (src_dir / "utils.ts").write_text(
            "export function formatName(first: string, last: string): string {\n  return `${first} ${last}`;\n}\n"
        )

        config = load_config()
        # Simulate initialize with workspace from roots
        config = set_workspace(config, f"file:///{tmp.replace(os.sep, '/')}")
        db = DatabaseManager(config["db_path"])
        db.initialize()
        indexer = IndexingEngine(db, config)
        indexer.run_full_index()
        ql = QueryLayer(db)

        # Test code_search (FTS5 requires exact token or prefix*)
        result = handle_code_search({"query": "HelloService"}, ql)
        assert "HelloService" in result, f"Expected HelloService in: {result}"
        print("  PASS: code_search")

        # Test code_symbols by name
        result = handle_code_symbols({"name": "greet"}, ql)
        assert "greet" in result, f"Expected greet in: {result}"
        print("  PASS: code_symbols (by name)")

        # Test code_symbols by file
        result = handle_code_symbols({"file": "src/hello.py"}, ql)
        assert "HelloService" in result, f"Expected HelloService in: {result}"
        print("  PASS: code_symbols (by file)")

        # Test code_modules
        result = handle_code_modules({}, ql)
        assert "Modules" in result, f"Expected Modules in: {result}"
        assert "hello.py" in result or "utils.ts" in result, f"Expected file-based module in: {result}"
        print("  PASS: code_modules")

        # Test code_index_status
        result = handle_code_index_status({}, ql, indexer)
        assert "Files:" in result, f"Expected Files: in: {result}"
        assert "python" in result, f"Expected python in: {result}"
        print("  PASS: code_index_status")

        # Test code_context
        result = handle_code_context({"file": "src/hello.py", "startLine": 1, "endLine": 3}, ql, tmp)
        assert "HelloService" in result, f"Expected HelloService in: {result}"
        print("  PASS: code_context")

        # Test re-index
        result = handle_code_index_status({"reindex": True}, ql, indexer)
        assert "Files:" in result
        print("  PASS: code_index_status (reindex)")

        db.close()
        print("\n7 passed, 0 failed")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    test_full_cycle()
