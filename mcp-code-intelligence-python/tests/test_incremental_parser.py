"""
KSA-171/178: Tests for IncrementalParser — caching, invalidation, eviction.
Tests the caching mechanism independent of tree-sitter native bindings.
"""

import pytest
from mcp_code_intel.parsers.incremental_parser import IncrementalParser, CachedAST
from mcp_code_intel.parsers.types import ParseResult, ExtractedSymbol, ExtractedRelationship


class MockParser:
    """Mock language parser for testing caching logic."""

    def __init__(self, language_id: str = "python"):
        self._language_id = language_id

    @property
    def language_id(self) -> str:
        return self._language_id

    def parse(self, source: str, file_path: str) -> ParseResult:
        """Simple regex extraction for testing."""
        symbols = []
        for i, line in enumerate(source.splitlines(), 1):
            stripped = line.strip()
            if stripped.startswith("class "):
                name = stripped.split()[1].rstrip(":({")
                symbols.append(ExtractedSymbol(
                    name=name, kind="class", file_path=file_path,
                    start_line=i, end_line=i, signature=f"class {name}",
                ))
            elif stripped.startswith("def ") or "fun " in stripped:
                if "fun " in stripped:
                    name = stripped.split("fun ")[1].split("(")[0].strip()
                else:
                    name = stripped.split("(")[0].replace("def ", "").strip()
                symbols.append(ExtractedSymbol(
                    name=name, kind="function", file_path=file_path,
                    start_line=i, end_line=i, signature=f"def {name}()",
                ))
        rels = []
        for i, line in enumerate(source.splitlines(), 1):
            if line.strip().startswith("import ") or line.strip().startswith("from "):
                target = line.strip().split()[-1]
                rels.append(ExtractedRelationship(
                    source_symbol="__file__", target_symbol=target,
                    kind="imports", file_path=file_path, line=i,
                ))
        return ParseResult(symbols=symbols, relationships=rels)

    def get_supported_extensions(self) -> list[str]:
        return [".py", ".kt", ".ts"]


class MockRegistry:
    """Mock GrammarRegistry that returns MockParser for known extensions."""

    def __init__(self):
        self._parser = MockParser()
        self._known = {".py", ".kt", ".kts", ".ts", ".tsx", ".java"}

    def get_parser(self, file_path: str):
        import os
        ext = os.path.splitext(file_path)[1]
        return self._parser if ext in self._known else None


@pytest.fixture
def registry():
    return MockRegistry()


@pytest.fixture
def parser(registry):
    return IncrementalParser(registry, max_cache_size=10)


class TestIncrementalParser:
    def test_parse_python_file_extracts_symbols(self, parser):
        source = """
import os
from pathlib import Path

class DataProcessor:
    def process(self, data):
        return data

def main():
    dp = DataProcessor()
"""
        result = parser.parse("processor.py", source)
        assert any(s.kind == "class" and s.name == "DataProcessor" for s in result.symbols)
        assert any(s.kind == "function" and s.name == "process" for s in result.symbols)
        assert any(s.kind == "function" and s.name == "main" for s in result.symbols)

    def test_cache_returns_same_result_for_same_content(self, parser):
        source = "class Foo:\n    def bar(self): pass"
        result1 = parser.parse("test.py", source)
        result2 = parser.parse("test.py", source)
        assert result1 == result2
        assert parser.is_cached("test.py")
        assert parser.cache_size == 1

    def test_invalidates_cache_on_content_change(self, parser):
        source1 = "class Foo:\n    def bar(self): pass"
        source2 = "class Foo:\n    def baz(self): pass"
        parser.parse("test.py", source1)
        assert parser.is_cached("test.py")
        result2 = parser.parse("test.py", source2)
        assert any(s.name == "baz" for s in result2.symbols)

    def test_invalidate_removes_from_cache(self, parser):
        parser.parse("test.py", "class X: pass")
        assert parser.is_cached("test.py")
        parser.invalidate("test.py")
        assert not parser.is_cached("test.py")
        assert parser.get_cached_result("test.py") is None

    def test_invalidate_all_clears_cache(self, parser):
        parser.parse("a.py", "class A: pass")
        parser.parse("b.py", "class B: pass")
        assert parser.cache_size == 2
        parser.invalidate_all()
        assert parser.cache_size == 0

    def test_evicts_oldest_when_max_reached(self, parser):
        for i in range(12):
            parser.parse(f"file{i}.py", f"class File{i}: pass")
        assert parser.cache_size <= 10

    def test_returns_empty_for_unsupported_extension(self, parser):
        result = parser.parse("file.xyz", "some content")
        assert len(result.symbols) == 0
        assert len(result.relationships) == 0

    def test_compute_hash_consistent(self):
        hash1 = IncrementalParser._compute_hash("hello world")
        hash2 = IncrementalParser._compute_hash("hello world")
        assert hash1 == hash2
        hash3 = IncrementalParser._compute_hash("hello world!")
        assert hash1 != hash3

    def test_parse_kotlin_file(self, parser):
        source = """
import java.io.File

class MyService:
    fun doWork(input: String): String {
        return input.uppercase()
    }
"""
        result = parser.parse("src/MyService.kt", source)
        assert any(s.kind == "class" and s.name == "MyService" for s in result.symbols)
        assert any(s.kind == "function" and s.name == "doWork" for s in result.symbols)

    def test_imports_extracted(self, parser):
        source = "import os\nfrom pathlib import Path"
        result = parser.parse("test.py", source)
        assert any(r.kind == "imports" for r in result.relationships)
        assert len(result.relationships) >= 2
