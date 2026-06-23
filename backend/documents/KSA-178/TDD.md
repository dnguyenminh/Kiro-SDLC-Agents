# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-178: [Python] Tree-sitter Core + Parsers

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-178 |
| Title | [Python] Tree-sitter Core + Parsers |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-178.docx |
| Related BRD | BRD-v1-KSA-178.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-26 | SA Agent | Initial technical design |

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

The Python Tree-sitter module follows a layered architecture:

```
┌─────────────────────────────────────────────────┐
│                  MCP Tool Layer                   │
│         (parse_file, get_symbols tools)          │
├─────────────────────────────────────────────────┤
│               Service Layer                      │
│    (ParserService, SymbolExtractionService)      │
├─────────────────────────────────────────────────┤
│                Core Layer                        │
│  (TreeSitterParser, AstConverter, ParserPool)    │
├─────────────────────────────────────────────────┤
│           Binding Layer (py-tree-sitter)          │
│    (ctypes/cffi bridge to native C library)      │
├─────────────────────────────────────────────────┤
│           Native Libraries (C)                   │
│  (libtree-sitter + language grammar .so/.dll)    │
└─────────────────────────────────────────────────┘
```

![Architecture](diagrams/architecture.png)

### 1.2 Design Principles

1. **Immutability**: AST nodes are frozen dataclasses after construction
2. **GIL-Aware**: Use multiprocessing for CPU-bound batch parsing
3. **Lazy Initialization**: Grammars loaded on demand, not at startup
4. **Fail-Safe**: Parse errors produce partial results, never crash
5. **Platform Parity**: Output structure matches nodejs v2 exactly
6. **Pythonic API**: Follow PEP 8, use type hints, context managers

---

## 2. Module Structure

### 2.1 Package Layout

```
mcp-code-intelligence-python/
├── src/
│   └── mcp_code_intelligence/
│       └── treesitter/                    # This module (KSA-178)
│           ├── __init__.py                # Public API exports
│           ├── parser.py                  # TreeSitterParser class
│           ├── parser_pool.py            # Process-safe parser pool
│           ├── grammar_registry.py       # Language grammar management
│           ├── language_detector.py      # File extension mapping
│           ├── ast_converter.py          # Tree → AstNode conversion
│           ├── symbol_extractor.py       # AST → Symbol extraction
│           ├── incremental_parser.py     # Incremental parse support
│           ├── models/
│           │   ├── __init__.py
│           │   ├── ast_node.py           # AstNode dataclass
│           │   ├── symbol.py             # Symbol dataclass
│           │   ├── parse_result.py       # ParseResult dataclass
│           │   ├── position.py           # Position dataclass
│           │   └── input_edit.py         # InputEdit dataclass
│           ├── languages/
│           │   ├── __init__.py
│           │   ├── base.py              # Base extraction rules
│           │   ├── python_rules.py      # Python-specific rules
│           │   ├── typescript_rules.py  # TS-specific rules
│           │   ├── java_rules.py        # Java-specific rules
│           │   ├── kotlin_rules.py      # Kotlin-specific rules
│           │   └── ...                  # One per language
│           └── exceptions.py            # Custom exceptions
├── tests/
│   ├── conftest.py                      # Shared fixtures
│   ├── test_parser.py
│   ├── test_grammar_registry.py
│   ├── test_ast_converter.py
│   ├── test_symbol_extractor.py
│   ├── test_incremental_parser.py
│   ├── test_parser_pool.py
│   ├── test_language_detector.py
│   ├── test_parity/                     # Cross-platform parity tests
│   │   ├── test_nodejs_comparison.py
│   │   └── fixtures/                    # Shared test fixtures
│   └── benchmarks/
│       ├── bench_parse.py
│       └── bench_symbols.py
├── pyproject.toml                        # Project config (Poetry)
├── poetry.lock
└── README.md
```

### 2.2 Component Diagram

![Component](diagrams/component.png)

---

## 3. Detailed Design

### 3.1 Binding Layer (py-tree-sitter)

#### 3.1.1 py-tree-sitter API Usage

```python
# py-tree-sitter provides these key classes:
# - tree_sitter.Parser: creates parser instances
# - tree_sitter.Language: loads grammar shared libraries
# - tree_sitter.Tree: parse result (immutable after parse)
# - tree_sitter.Node: AST node with children, type, text

from tree_sitter import Parser, Language

# Load a language grammar
PYTHON_LANGUAGE = Language('/path/to/tree-sitter-python.so', 'python')

# Create parser and set language
parser = Parser()
parser.set_language(PYTHON_LANGUAGE)

# Parse source code
tree = parser.parse(b"def hello(): pass")
root = tree.root_node
```

#### 3.1.2 Memory Management

```python
class ManagedParser:
    """Context manager for parser lifecycle."""
    
    def __init__(self, language: str):
        self._parser = Parser()
        self._language = language
        grammar = grammar_registry.get(language)
        self._parser.set_language(grammar)
    
    def __enter__(self) -> Parser:
        return self._parser
    
    def __exit__(self, *args):
        # py-tree-sitter handles cleanup via Python GC
        # but we explicitly clear references for large trees
        self._parser = None
```

### 3.2 Parser Pool

```python
import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor
from typing import Optional

class ParserPool:
    """Process-based parser pool for parallel parsing (bypasses GIL)."""
    
    def __init__(self, max_workers: Optional[int] = None):
        self._max_workers = max_workers or mp.cpu_count()
        self._executor: Optional[ProcessPoolExecutor] = None
    
    def start(self):
        self._executor = ProcessPoolExecutor(
            max_workers=self._max_workers,
            initializer=_worker_init,
        )
    
    def parse_batch(self, file_paths: list[str]) -> list['ParseResult']:
        """Parse multiple files in parallel across processes."""
        futures = [
            self._executor.submit(_parse_single, path)
            for path in file_paths
        ]
        return [f.result(timeout=30) for f in futures]
    
    def shutdown(self):
        if self._executor:
            self._executor.shutdown(wait=True)
    
    def __enter__(self):
        self.start()
        return self
    
    def __exit__(self, *args):
        self.shutdown()


def _worker_init():
    """Initialize parser in worker process."""
    global _worker_parser, _worker_registry
    _worker_parser = Parser()
    _worker_registry = GrammarRegistry()


def _parse_single(file_path: str) -> 'ParseResult':
    """Parse a single file in worker process."""
    from pathlib import Path
    path = Path(file_path)
    language = detect_language(path.suffix)
    grammar = _worker_registry.load(language)
    _worker_parser.set_language(grammar)
    source = path.read_bytes()
    tree = _worker_parser.parse(source)
    ast = convert_to_ast_node(tree.root_node, source)
    return ParseResult(tree=tree, ast=ast, language=language, ...)
```

### 3.3 Grammar Registry

```python
from pathlib import Path
from threading import Lock
from tree_sitter import Language

class GrammarRegistry:
    """Thread-safe registry for loaded language grammars."""
    
    GRAMMAR_MAP: dict[str, str] = {
        "typescript": "tree-sitter-typescript",
        "javascript": "tree-sitter-javascript",
        "python": "tree-sitter-python",
        "java": "tree-sitter-java",
        "kotlin": "tree-sitter-kotlin",
        "go": "tree-sitter-go",
        "rust": "tree-sitter-rust",
        "csharp": "tree-sitter-c-sharp",
        "ruby": "tree-sitter-ruby",
        "php": "tree-sitter-php",
        "swift": "tree-sitter-swift",
        "scala": "tree-sitter-scala",
    }
    
    def __init__(self, grammar_dir: Optional[Path] = None):
        self._grammars: dict[str, Language] = {}
        self._lock = Lock()
        self._grammar_dir = grammar_dir or self._default_grammar_dir()
    
    def load(self, language: str) -> Language:
        """Load grammar lazily (thread-safe)."""
        if language in self._grammars:
            return self._grammars[language]
        
        with self._lock:
            # Double-check after acquiring lock
            if language in self._grammars:
                return self._grammars[language]
            
            grammar_name = self.GRAMMAR_MAP.get(language)
            if grammar_name is None:
                raise GrammarNotFoundError(f"No grammar for: {language}")
            
            lib_path = self._resolve_path(grammar_name)
            grammar = Language(str(lib_path), language)
            self._grammars[language] = grammar
            return grammar
    
    def is_loaded(self, language: str) -> bool:
        return language in self._grammars
    
    def supported_languages(self) -> list[str]:
        return list(self.GRAMMAR_MAP.keys())
    
    def _resolve_path(self, grammar_name: str) -> Path:
        """Resolve grammar shared library path based on platform."""
        import platform
        system = platform.system().lower()
        ext = {"linux": ".so", "darwin": ".dylib", "windows": ".dll"}.get(system, ".so")
        path = self._grammar_dir / f"{grammar_name}{ext}"
        if not path.exists():
            raise GrammarNotFoundError(f"Grammar file not found: {path}")
        return path
    
    @staticmethod
    def _default_grammar_dir() -> Path:
        """Default grammar directory (bundled with package)."""
        return Path(__file__).parent / "grammars"
```

### 3.4 AST Converter

```python
from tree_sitter import Node as TSNode
from .models import AstNode, Position

class AstConverter:
    """Convert tree-sitter Node tree to platform-agnostic AstNode."""
    
    MAX_TEXT_LENGTH = 1000
    
    def convert(self, root: TSNode, source: bytes) -> AstNode:
        return self._convert_node(root, source, field_name=None)
    
    def _convert_node(self, node: TSNode, source: bytes, field_name: Optional[str]) -> AstNode:
        start_point = node.start_point
        end_point = node.end_point
        child_count = node.child_count
        
        # Only include text for leaf nodes or small nodes
        text = None
        byte_length = node.end_byte - node.start_byte
        if child_count == 0 or byte_length <= self.MAX_TEXT_LENGTH:
            text = source[node.start_byte:node.end_byte].decode('utf-8', errors='replace')
        
        children = []
        for i in range(child_count):
            child = node.children[i]
            child_field = node.field_name_for_child(i)
            children.append(self._convert_node(child, source, child_field))
        
        return AstNode(
            type=node.type,
            text=text,
            start_position=Position(row=start_point[0], column=start_point[1]),
            end_position=Position(row=end_point[0], column=end_point[1]),
            start_byte=node.start_byte,
            end_byte=node.end_byte,
            is_named=node.is_named,
            field_name=field_name,
            children=children,
            is_error=(node.type == "ERROR"),
        )
```

### 3.5 Symbol Extractor

```python
from .models import Symbol, SymbolKind, Visibility, Position
from .languages.base import LanguageExtractionRules

class SymbolExtractor:
    """Extract code symbols from AST nodes."""
    
    def __init__(self, language_rules: dict[str, LanguageExtractionRules]):
        self._rules = language_rules
    
    def extract(self, ast: AstNode, language: str, file_path: str) -> list[Symbol]:
        rules = self._rules.get(language)
        if rules is None:
            raise UnsupportedLanguageError(f"No extraction rules for: {language}")
        
        symbols: list[Symbol] = []
        self._visit(ast, rules, symbols, scope_stack=[], file_path=file_path, language=language)
        return symbols
    
    def _visit(
        self,
        node: AstNode,
        rules: LanguageExtractionRules,
        symbols: list[Symbol],
        scope_stack: list[str],
        file_path: str,
        language: str,
    ):
        matched_rule = rules.match(node)
        pushed_scope = False
        
        if matched_rule is not None:
            symbol = matched_rule.extract(
                node=node,
                scope=scope_stack[-1] if scope_stack else None,
                file_path=file_path,
                language=language,
            )
            symbols.append(symbol)
            
            if matched_rule.creates_scope:
                scope_stack.append(symbol.name)
                pushed_scope = True
        
        for child in node.children:
            if child.is_named:
                self._visit(child, rules, symbols, scope_stack, file_path, language)
        
        if pushed_scope:
            scope_stack.pop()
```

### 3.6 Incremental Parser

```python
from tree_sitter import Parser, Tree
from .models import InputEdit, ParseResult, AstNode

class IncrementalParser:
    """Supports incremental re-parsing for file edits."""
    
    FALLBACK_THRESHOLD = 0.3  # 30% edit ratio triggers full re-parse
    MAX_CACHE_SIZE = 1000
    
    def __init__(self, grammar_registry: GrammarRegistry, ast_converter: AstConverter):
        self._registry = grammar_registry
        self._converter = ast_converter
        self._tree_cache: dict[str, Tree] = {}  # file_path -> Tree
    
    def parse_incremental(
        self,
        file_path: str,
        edit: InputEdit,
        new_source: bytes,
        language: str,
    ) -> ParseResult:
        cached_tree = self._tree_cache.get(file_path)
        
        if cached_tree is None:
            return self._full_parse(file_path, new_source, language)
        
        # Check fallback threshold
        edit_size = abs(edit.new_end_byte - edit.start_byte)
        if len(new_source) > 0 and edit_size / len(new_source) > self.FALLBACK_THRESHOLD:
            return self._full_parse(file_path, new_source, language)
        
        # Apply edit to cached tree
        cached_tree.edit(
            start_byte=edit.start_byte,
            old_end_byte=edit.old_end_byte,
            new_end_byte=edit.new_end_byte,
            start_point=edit.start_point,
            old_end_point=edit.old_end_point,
            new_end_point=edit.new_end_point,
        )
        
        # Re-parse with old tree
        parser = Parser()
        parser.set_language(self._registry.load(language))
        
        import time
        start = time.perf_counter_ns()
        new_tree = parser.parse(new_source, cached_tree)
        elapsed_ms = (time.perf_counter_ns() - start) / 1_000_000
        
        ast = self._converter.convert(new_tree.root_node, new_source)
        self._tree_cache[file_path] = new_tree
        self._evict_if_needed()
        
        return ParseResult(
            tree=new_tree, ast=ast, language=language,
            parse_time_ms=elapsed_ms,
            has_errors=new_tree.root_node.has_error,
            error_count=self._count_errors(ast),
        )
    
    def _full_parse(self, file_path: str, source: bytes, language: str) -> ParseResult:
        parser = Parser()
        parser.set_language(self._registry.load(language))
        
        import time
        start = time.perf_counter_ns()
        tree = parser.parse(source)
        elapsed_ms = (time.perf_counter_ns() - start) / 1_000_000
        
        ast = self._converter.convert(tree.root_node, source)
        self._tree_cache[file_path] = tree
        self._evict_if_needed()
        
        return ParseResult(
            tree=tree, ast=ast, language=language,
            parse_time_ms=elapsed_ms,
            has_errors=tree.root_node.has_error,
            error_count=self._count_errors(ast),
        )
    
    def _evict_if_needed(self):
        """LRU eviction when cache exceeds max size."""
        while len(self._tree_cache) > self.MAX_CACHE_SIZE:
            oldest_key = next(iter(self._tree_cache))
            del self._tree_cache[oldest_key]
    
    @staticmethod
    def _count_errors(ast: AstNode) -> int:
        count = 1 if ast.is_error else 0
        for child in ast.children:
            count += IncrementalParser._count_errors(child)
        return count
```

---

## 4. Security Design

### 4.1 Input Validation

| Input | Validation | Rationale |
|-------|-----------|-----------|
| File path | `Path.resolve()`, check within workspace | Prevent path traversal |
| Source bytes | Max size 50MB | Prevent OOM |
| Language ID | Whitelist of 12 supported | Prevent arbitrary grammar load |
| Edit ranges | Bounds check against source length | Prevent buffer overflow in native |

### 4.2 Native Code Safety

- py-tree-sitter handles native memory internally
- Python GC manages object lifecycle
- Context managers ensure cleanup on exceptions
- No user-controlled data passed directly to native without validation
- `signal.alarm()` for parse timeout on Unix (threading.Timer on Windows)

---

## 5. Error Handling

| Layer | Error Type | Handling Strategy |
|-------|-----------|-------------------|
| Import | ImportError | Clear message: "pip install py-tree-sitter" |
| Native | Segfault | Signal handler catches, wraps in ParserInitError |
| Parser | Syntax error | Return partial AST with ERROR nodes |
| Grammar | Load failure | GrammarNotFoundError, mark language unavailable |
| Pool | Timeout | TimeoutError after 5s per file, 30s for batch |
| Memory | OOM | MemoryError, release resources |
| File I/O | Not found | FileNotFoundError with path details |

---

## 6. Performance Design

### 6.1 Concurrency Strategy

- **Single file**: Direct parse in current thread (GIL released during C call)
- **Batch (< 10 files)**: ThreadPoolExecutor (GIL released during native parse)
- **Batch (>= 10 files)**: ProcessPoolExecutor (true parallelism, bypasses GIL)
- **Incremental**: Always in current thread (fast, < 10ms)

### 6.2 Memory Optimization

- Lazy text extraction (only for leaf nodes or small subtrees)
- Frozen dataclasses (no extra dict overhead)
- Tree cache with LRU eviction (max 1000 entries)
- Grammar objects cached (never re-loaded)
- `__slots__` on hot-path classes for reduced memory

### 6.3 Python-Specific Optimizations

- Use `bytes` for source (avoid str encode/decode overhead)
- `orjson` for JSON serialization (10x faster than stdlib json)
- `functools.lru_cache` for language detection
- Avoid deep recursion: iterative AST traversal for large files (> 50K nodes)

---

## 7. Testing Strategy

### 7.1 Unit Tests (pytest)

| Test Module | Coverage |
|------------|----------|
| `test_parser.py` | Init, parse, error handling |
| `test_grammar_registry.py` | Load, cache, missing grammar |
| `test_ast_converter.py` | Node conversion, text extraction |
| `test_symbol_extractor.py` | All 12 languages, all symbol kinds |
| `test_incremental_parser.py` | Edit, fallback, cache |
| `test_parser_pool.py` | Batch, timeout, concurrency |
| `test_language_detector.py` | Extension mapping, edge cases |

### 7.2 Integration Tests

- Parse real-world files from each language (stdlib samples)
- Cross-platform comparison with nodejs v2 output (JSON diff)
- Concurrent parsing stress test (100 files, multiprocessing)
- Memory leak detection (parse 10K files, check RSS)

### 7.3 Property-Based Tests (Hypothesis)

- Any valid source parses without crash
- Incremental parse == full re-parse for same final content
- Symbol extraction is deterministic (same input → same output)
- AST node positions are monotonically increasing

### 7.4 Performance Tests (pytest-benchmark)

- Benchmark: parse 10K LOC file (must < 500ms)
- Benchmark: batch parse 1000 files (must < 30s)
- Benchmark: incremental parse single char (must < 10ms)
- Benchmark: symbol extraction 1000 files (must < 3s)

---

## 8. Implementation Checklist

### Files to Create

| # | File | Purpose | Priority |
|---|------|---------|----------|
| 1 | `__init__.py` | Public API exports | P0 |
| 2 | `parser.py` | TreeSitterParser class | P0 |
| 3 | `parser_pool.py` | Process-based pool | P1 |
| 4 | `grammar_registry.py` | Grammar management | P0 |
| 5 | `language_detector.py` | Extension mapping | P0 |
| 6 | `ast_converter.py` | Tree → AstNode | P0 |
| 7 | `symbol_extractor.py` | Symbol extraction | P0 |
| 8 | `incremental_parser.py` | Incremental support | P1 |
| 9 | `models/__init__.py` | Model exports | P0 |
| 10 | `models/ast_node.py` | AstNode dataclass | P0 |
| 11 | `models/symbol.py` | Symbol dataclass | P0 |
| 12 | `models/parse_result.py` | ParseResult dataclass | P0 |
| 13 | `models/position.py` | Position dataclass | P0 |
| 14 | `models/input_edit.py` | InputEdit dataclass | P1 |
| 15 | `languages/base.py` | Base extraction rules | P0 |
| 16 | `languages/python_rules.py` | Python-specific rules | P0 |
| 17 | `languages/typescript_rules.py` | TS-specific rules | P0 |
| 18 | `languages/java_rules.py` | Java-specific rules | P0 |
| 19 | `languages/kotlin_rules.py` | Kotlin-specific rules | P0 |
| 20 | `exceptions.py` | Custom exceptions | P0 |
| 21 | `pyproject.toml` | Project config | P0 |

### Dependencies (pyproject.toml)

```toml
[tool.poetry]
name = "mcp-code-intelligence"
version = "0.1.0"
python = "^3.11"

[tool.poetry.dependencies]
python = "^3.11"
tree-sitter = "^0.22.0"
orjson = "^3.10.0"

[tool.poetry.group.dev.dependencies]
pytest = "^8.0"
pytest-benchmark = "^4.0"
pytest-cov = "^5.0"
hypothesis = "^6.100"
ruff = "^0.4"
mypy = "^1.10"
```

---

## 9. Deployment Considerations

### 9.1 Grammar Distribution

- Bundle grammar .so/.dylib/.dll files in wheel (platform-specific wheels)
- Use `tree-sitter-languages` package as alternative (pre-built grammars)
- Total size: ~15MB (all grammars combined)
- Fallback: build grammars from source via `tree_sitter.Language.build_library()`

### 9.2 Platform Wheels

- Build wheels for: linux-x64, macos-arm64, windows-x64
- Use `cibuildwheel` in CI for cross-platform builds
- Pure Python code + native grammar binaries = platform-specific wheel

### 9.3 Installation

```bash
pip install mcp-code-intelligence[parsers]
# or
poetry add mcp-code-intelligence
```

---

## 10. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
| 3 | Class Diagram | [class-diagram.png](diagrams/class-diagram.png) | [class-diagram.drawio](diagrams/class-diagram.drawio) |
