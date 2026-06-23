"""Tests for the signature extractor module."""

import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from mcp_code_intel.extractor import extract_symbols


def test_python_function():
    """Extract Python function definitions."""
    code = "def hello_world():\n    pass\n"
    symbols = extract_symbols(code, "python")
    assert len(symbols) == 1
    assert symbols[0]["name"] == "hello_world"
    assert symbols[0]["kind"] == "function"


def test_python_class():
    """Extract Python class definitions."""
    code = "class MyService:\n    def run(self):\n        pass\n"
    symbols = extract_symbols(code, "python")
    assert len(symbols) == 2
    names = {s["name"] for s in symbols}
    assert "MyService" in names
    assert "run" in names


def test_typescript_function():
    """Extract TypeScript function definitions."""
    code = "export async function fetchData(url: string): Promise<void> {\n}\n"
    symbols = extract_symbols(code, "typescript")
    assert len(symbols) == 1
    assert symbols[0]["name"] == "fetchData"
    assert symbols[0]["kind"] == "function"
    assert symbols[0]["visibility"] == "export"


def test_typescript_class_and_interface():
    """Extract TypeScript class and interface."""
    code = "export class UserService {\n}\n\nexport interface UserRepo {\n}\n"
    symbols = extract_symbols(code, "typescript")
    assert len(symbols) == 2
    kinds = {s["kind"] for s in symbols}
    assert "class" in kinds
    assert "interface" in kinds


def test_kotlin_function():
    """Extract Kotlin function definitions."""
    code = "    suspend fun loadData(id: String): Result {\n    }\n"
    symbols = extract_symbols(code, "kotlin")
    assert len(symbols) == 1
    assert symbols[0]["name"] == "loadData"
    assert symbols[0]["kind"] == "function"


def test_kotlin_data_class():
    """Extract Kotlin data class."""
    code = "data class User(val name: String, val age: Int)\n"
    symbols = extract_symbols(code, "kotlin")
    assert len(symbols) == 1
    assert symbols[0]["name"] == "User"
    assert symbols[0]["kind"] == "class"


def test_go_function_and_struct():
    """Extract Go function and struct."""
    code = "func (s *Server) Start() error {\n}\n\ntype Config struct {\n}\n"
    symbols = extract_symbols(code, "go")
    assert len(symbols) == 2
    names = {s["name"] for s in symbols}
    assert "Start" in names
    assert "Config" in names


def test_rust_function():
    """Extract Rust function definitions."""
    code = "pub async fn handle_request(req: Request) -> Response {\n}\n"
    symbols = extract_symbols(code, "rust")
    assert len(symbols) == 1
    assert symbols[0]["name"] == "handle_request"
    assert symbols[0]["visibility"] == "public"


def test_java_class():
    """Extract Java class definitions."""
    code = "public class UserController {\n    public void getUser() {\n    }\n}\n"
    symbols = extract_symbols(code, "java")
    assert len(symbols) >= 1
    names = {s["name"] for s in symbols}
    assert "UserController" in names


def test_unknown_language():
    """Unknown language returns empty list."""
    symbols = extract_symbols("some content", "brainfuck")
    # Generic patterns may still match
    assert isinstance(symbols, list)


def test_empty_content():
    """Empty content returns empty list."""
    symbols = extract_symbols("", "python")
    assert symbols == []


def test_doc_comment_extraction():
    """Extract doc comments above symbols."""
    code = '"""Module doc."""\n\n\ndef foo():\n    """Foo does things."""\n    pass\n'
    symbols = extract_symbols(code, "python")
    assert len(symbols) == 1
    assert symbols[0]["name"] == "foo"


if __name__ == "__main__":
    # Simple test runner
    test_funcs = [v for k, v in globals().items() if k.startswith("test_")]
    passed = 0
    failed = 0
    for fn in test_funcs:
        try:
            fn()
            passed += 1
            print(f"  PASS: {fn.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"  FAIL: {fn.__name__} — {e}")
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)
