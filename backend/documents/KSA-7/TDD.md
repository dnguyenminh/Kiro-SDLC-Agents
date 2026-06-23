# Technical Design Document (TDD)

## Code Indexer Python — KSA-7: Code Indexer — Python version

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-7 |
| Title | Code Indexer — Python version |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-10 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-7.docx |
| Related FSD | FSD-v1-KSA-7.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | SA Agent | Initiate document from FSD KSA-7 |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies the technical design for the Code Indexer Python tool — a standalone CLI script that analyzes source code projects and generates structured metadata. It covers architecture, module design, parsing strategies, and implementation details.

### 1.2 Scope

- Python CLI application with 12+ source files
- Regex-based parsing for 7 programming languages
- File I/O for reading source and writing JSON/Markdown output
- No network, no database, no external dependencies

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | Python | 3.10+ |
| Build Tool | None (stdlib only) | — |
| Testing | unittest (stdlib) | — |
| CLI | argparse (stdlib) | — |
| Data Classes | dataclasses (stdlib) | — |
| File I/O | pathlib (stdlib) | — |
| Hashing | hashlib (stdlib) | — |
| Pattern Matching | re (stdlib) | — |

### 1.4 Design Principles

- **Single Responsibility** — each file handles one concern
- **Zero Dependencies** — stdlib only, no pip install
- **200-Line Limit** — every file ≤ 200 lines
- **20-Line Functions** — every function ≤ 20 lines
- **Early Return** — avoid deep nesting
- **Plugin Architecture** — one parser file per language for extensibility

### 1.5 Constraints

- Python 3.10+ required (for `match` statements, modern type hints)
- No external packages (no pip install step)
- All files ≤ 200 lines (code standards enforcement)
- Regex-only parsing (no AST libraries)
- Cross-platform (Windows/macOS/Linux path handling via pathlib)

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-7.docx |
| FSD | FSD-v1-KSA-7.docx |
| Code Standards | .kiro/steering/code-standards.md |

---

## 2. System Architecture

### 2.1 Architecture Overview

The Code Indexer follows a **pipeline architecture** — data flows sequentially through stages, each transforming input into output for the next stage.

![Architecture Diagram](diagrams/architecture.png)

```
┌─────────────────────────────────────────────────────────┐
│                    Code Indexer Pipeline                  │
│                                                          │
│  CLI Args → Config → Detect → Discover → Scan → Parse → Generate
│                                                          │
│  main.py orchestrates the pipeline                       │
└─────────────────────────────────────────────────────────┘
```

**Architecture Style:** Pipeline / Pipes-and-Filters
**Rationale:** Each stage is independent, testable, and replaceable. No shared mutable state between stages.

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | File |
|-----------|---------------|------|
| CLI / Orchestrator | Parse args, run pipeline, handle errors | main.py |
| Config Loader | Load/validate index-config.json | config.py |
| Project Detector | Detect project types from build files | detector.py |
| Module Discovery | Find modules/packages in project | discovery.py |
| File Scanner | Walk directories, filter files | scanner.py |
| Parser Dispatcher | Route files to language-specific parsers | parser.py |
| Language Parsers | Extract signatures via regex | parsers/*.py |
| Output Generator | Write all output files | generator.py |
| Data Models | Dataclass definitions | models.py |
| Utilities | Hash, path helpers, file I/O | utils.py |

### 2.3 Deployment Architecture

No deployment infrastructure needed. This is a local CLI tool.

**Distribution:** Single directory of `.py` files, copied to `.analysis/code-intelligence/scripts/python/`

**Execution:** `python main.py <project-root>`

### 2.4 Communication Patterns

| From | To | Pattern | Data |
|------|----|---------|------|
| main.py | config.py | Function call | Config dataclass |
| main.py | detector.py | Function call | list[str] project types |
| main.py | discovery.py | Function call | list[Module] |
| main.py | scanner.py | Function call | list[SourceFile] |
| main.py | parser.py | Function call | list[Signature] per file |
| main.py | generator.py | Function call | Output files written |

All communication is synchronous function calls. No async, no threads, no IPC.

---

## 3. API Design

### 3.1 CLI Interface (the "API")

This tool has no HTTP API. The CLI is the interface.

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| project_root | positional | Yes | — | Path to project directory |
| --config | optional | No | auto | Path to index-config.json |
| --verbose | flag | No | false | Enable detailed logging |
| --output | optional | No | .analysis/code-intelligence | Output directory |

### 3.2 Module Public APIs

#### config.py

```python
def load_config(project_root: Path, config_path: Path | None = None) -> Config:
    """Load configuration from file or return defaults."""
```

#### detector.py

```python
def detect_project_types(root: Path) -> list[str]:
    """Detect project types from build files in root + 1 level deep."""
```

#### discovery.py

```python
def discover_modules(root: Path, project_types: list[str]) -> list[Module]:
    """Discover modules based on project type conventions."""
```

#### scanner.py

```python
def scan_module_files(module: Module, config: Config) -> list[SourceFile]:
    """Scan module directory for source files matching config."""
```

#### parser.py

```python
def parse_file(source_file: SourceFile) -> list[Signature]:
    """Parse a source file and extract signatures."""
```

#### generator.py

```python
def generate_outputs(project: ProjectInfo, output_dir: Path) -> None:
    """Generate all output files (project-structure.md, modules/*.md, metadata, payloads)."""
```

---

## 4. Data Design

### 4.1 No Database

This tool has no persistent storage. All data is in-memory during execution and written to files at the end.

### 4.2 Output File Schemas

#### index-metadata.json

```json
{
  "project_name": "string",
  "project_types": ["string"],
  "indexed_at": "ISO-8601",
  "total_files": 0,
  "total_modules": 0,
  "total_signatures": 0,
  "files": [
    {
      "path": "relative/path.kt",
      "hash": "sha256-hex",
      "lines": 0,
      "signatures": 0,
      "language": "kotlin",
      "module": "module-name"
    }
  ]
}
```

#### kb-payloads.json

```json
[
  {
    "title": "Code Index — module-name",
    "content": "Module: module-name\nLanguage: kotlin\nFiles: 15\n\nKey Classes:\n- MyClass\n- MyService\n\nKey Functions:\n- processData()\n- validateInput()",
    "tags": "code-index, module-name, kotlin"
  }
]
```

---

## 5. Class / Module Design

### 5.1 Package Structure

```
code-indexer/
├── main.py              ← Entry point (CLI parsing + pipeline orchestration)
├── config.py            ← Config loading, defaults, validation
├── detector.py          ← Project type detection logic
├── discovery.py         ← Module discovery strategies
├── scanner.py           ← File walking + filtering
├── parser.py            ← Parser dispatcher (routes to language parsers)
├── parsers/
│   ├── __init__.py      ← Parser registry
│   ├── kotlin.py        ← Kotlin regex patterns
│   ├── java.py          ← Java regex patterns
│   ├── python_lang.py   ← Python regex patterns (named to avoid conflict)
│   ├── typescript.py    ← TypeScript regex patterns
│   ├── javascript.py    ← JavaScript regex patterns
│   ├── go_lang.py       ← Go regex patterns (named to avoid conflict)
│   └── rust.py          ← Rust regex patterns
├── generator.py         ← Output file generation
├── models.py            ← All dataclass definitions
└── utils.py             ← Shared utilities
```

### 5.2 Data Models (models.py)

```python
from dataclasses import dataclass, field
from pathlib import Path

@dataclass
class Config:
    extensions: list[str]
    exclude_dirs: list[str]
    exclude_patterns: list[str]
    max_file_size_kb: int

@dataclass
class Signature:
    name: str
    kind: str          # class/function/interface/enum/struct/trait/impl/method
    visibility: str    # public/private/internal/protected
    line: int
    params: str = ""
    decorators: list[str] = field(default_factory=list)

@dataclass
class SourceFile:
    path: Path
    relative_path: str
    language: str
    lines: int = 0
    hash: str = ""
    signatures: list[Signature] = field(default_factory=list)

@dataclass
class Module:
    name: str
    path: Path
    language: str
    files: list[SourceFile] = field(default_factory=list)

@dataclass
class ProjectInfo:
    name: str
    root_path: Path
    types: list[str]
    modules: list[Module]
    total_files: int = 0
    total_signatures: int = 0
```

### 5.3 Parser Design (Strategy Pattern)

Each language parser implements the same interface:

```python
# parsers/kotlin.py
PATTERNS: list[tuple[str, re.Pattern]] = [
    ("class", re.compile(r"^(?:(?:public|private|internal|abstract|open|data|sealed)\s+)*class\s+(\w+)")),
    ("interface", re.compile(r"^(?:(?:public|private|internal)\s+)*interface\s+(\w+)")),
    ("function", re.compile(r"^(?:(?:public|private|internal|override|suspend)\s+)*fun\s+(\w+)\s*\(")),
    ("object", re.compile(r"^(?:(?:public|private|internal)\s+)*object\s+(\w+)")),
    ("enum", re.compile(r"^(?:(?:public|private|internal)\s+)*enum\s+class\s+(\w+)")),
]

def parse(content: str) -> list[Signature]:
    """Extract Kotlin signatures from file content."""
```

**Parser Registry (parsers/__init__.py):**

```python
from parsers import kotlin, java, python_lang, typescript, javascript, go_lang, rust

PARSER_MAP: dict[str, module] = {
    ".kt": kotlin, ".kts": kotlin,
    ".java": java,
    ".py": python_lang,
    ".ts": typescript, ".tsx": typescript,
    ".js": javascript, ".jsx": javascript,
    ".go": go_lang,
    ".rs": rust,
}
```

### 5.4 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Pipeline | main.py orchestration | Sequential data transformation |
| Strategy | parsers/ directory | One parser per language, same interface |
| Registry | parsers/__init__.py | Map extensions to parser modules |
| Data Transfer Object | models.py dataclasses | Structured data passing between stages |
| Early Return | All functions | Avoid deep nesting, handle errors first |

### 5.5 Error Handling Strategy

| Error Type | Handling | User Impact |
|-----------|----------|-------------|
| Invalid CLI args | Print usage, exit(2) | Immediate feedback |
| Directory not found | Print error, exit(1) | Clear error message |
| Config parse error | Log warning, use defaults | Continues with defaults |
| File read error | Log warning, skip file | File excluded from results |
| Binary file detected | Skip silently | File excluded from results |
| Encoding error | Log warning, skip file | File excluded from results |
| Regex parse failure | Log warning, return empty | File has 0 signatures |
| Output write error | Print error, exit(1) | Fatal — cannot produce output |

---

## 6. Integration Design

### 6.1 Filesystem Integration

| Attribute | Value |
|-----------|-------|
| Protocol | Local filesystem (pathlib) |
| Read | Source code files (UTF-8) |
| Write | Output files (JSON, Markdown) |
| Error Handling | Try/except on every I/O operation |

### 6.2 Knowledge Base Integration (Indirect)

The indexer generates `kb-payloads.json`. A separate process (SM agent) reads this file and calls `kb_ingest` for each payload. The indexer itself does NOT call any API.

---

## 7. Security Design

### 7.1 Security Constraints

| Constraint | Implementation |
|-----------|----------------|
| Read-only source access | Never open source files in write mode |
| No network access | No socket/http imports used |
| No code execution | Never eval/exec parsed content |
| No secrets in output | Output contains only signatures, not file contents |

### 7.2 Input Validation

| Input | Validation | Sanitization |
|-------|-----------|--------------|
| project_root | Must be existing directory | Resolve to absolute path |
| config JSON | Must be valid JSON with expected keys | Ignore unknown keys |
| File content | Check for null bytes (binary detection) | Skip binary files |
| File paths | Use pathlib for safe path handling | No string concatenation |

---

## 8. Performance Design

### 8.1 Performance Targets

| Operation | Target | Strategy |
|-----------|--------|----------|
| 100-file project | < 5 seconds | Sequential I/O, compiled regex |
| 1000-file project | < 30 seconds | Pre-compiled regex, minimal allocations |
| Single file parse | < 10 ms | Compiled regex patterns |

### 8.2 Optimization Strategies

1. **Pre-compile all regex patterns** at module load time (not per-file)
2. **Read file once** — compute hash and parse from same content buffer
3. **Skip early** — check extension before reading, check size before parsing
4. **Minimal string operations** — use regex groups directly
5. **No unnecessary copies** — pass references, not copies of large strings

### 8.3 Memory Usage

- Files read one at a time (not all loaded into memory)
- Signatures stored as lightweight dataclass instances
- Output generated incrementally (modules/*.md written per-module)

---

## 9. Monitoring & Observability

### 9.1 Logging

| Event | Level | Output |
|-------|-------|--------|
| Start indexing | INFO | stdout |
| Config loaded | DEBUG | stdout (--verbose) |
| Project type detected | INFO | stdout |
| Module discovered | DEBUG | stdout (--verbose) |
| File skipped (binary) | DEBUG | stdout (--verbose) |
| File skipped (encoding) | WARNING | stderr |
| Parse error | WARNING | stderr |
| Output written | INFO | stdout |
| Summary | INFO | stdout (always) |

### 9.2 Summary Output

Always printed at end:
```
Code Indexer — Python v1.0
Project: {name}
Types: {types}
Modules: {count}
Files indexed: {count}
Signatures: {count}
Skipped: {count} (binary: {n}, encoding: {n}, too large: {n})
Time: {seconds}s
Output: {path}
```

---

## 10. Testing Strategy

### 10.1 Test Structure

```
tests/
├── test_config.py       ← Config loading tests
├── test_detector.py     ← Project type detection tests
├── test_discovery.py    ← Module discovery tests
├── test_scanner.py      ← File scanning tests
├── test_parser.py       ← Parser dispatcher tests
├── test_parsers/
│   ├── test_kotlin.py   ← Kotlin parser tests
│   ├── test_java.py     ← Java parser tests
│   ├── test_python.py   ← Python parser tests
│   ├── test_typescript.py
│   ├── test_javascript.py
│   ├── test_go.py
│   └── test_rust.py
├── test_generator.py    ← Output generation tests
├── test_integration.py  ← End-to-end tests
└── fixtures/            ← Sample project structures for testing
    ├── gradle-project/
    ├── npm-project/
    ├── python-project/
    └── mixed-project/
```

### 10.2 Test Approach

| Level | What | How |
|-------|------|-----|
| Unit | Each parser, detector, scanner | unittest with fixtures |
| Integration | Full pipeline on sample projects | Run main.py on fixtures/ |
| Self-test | Index the indexer itself | Verify correct self-analysis |

---

## 11. Implementation Checklist

### Files to Create

| # | File | Lines (est.) | Responsibility |
|---|------|-------------|----------------|
| 1 | main.py | ~80 | CLI args, pipeline orchestration |
| 2 | config.py | ~60 | Config loading, defaults |
| 3 | detector.py | ~70 | Project type detection |
| 4 | discovery.py | ~90 | Module discovery |
| 5 | scanner.py | ~70 | File walking, filtering |
| 6 | parser.py | ~40 | Parser dispatcher |
| 7 | parsers/__init__.py | ~30 | Parser registry |
| 8 | parsers/kotlin.py | ~60 | Kotlin regex patterns |
| 9 | parsers/java.py | ~60 | Java regex patterns |
| 10 | parsers/python_lang.py | ~50 | Python regex patterns |
| 11 | parsers/typescript.py | ~60 | TypeScript regex patterns |
| 12 | parsers/javascript.py | ~50 | JavaScript regex patterns |
| 13 | parsers/go_lang.py | ~50 | Go regex patterns |
| 14 | parsers/rust.py | ~60 | Rust regex patterns |
| 15 | generator.py | ~120 | Output file generation |
| 16 | models.py | ~60 | Dataclass definitions |
| 17 | utils.py | ~50 | Hash, path helpers, I/O |

**Total estimated:** ~1,110 lines across 17 files (avg 65 lines/file)

### Implementation Order

1. models.py (data structures first)
2. utils.py (shared helpers)
3. config.py (configuration)
4. detector.py (project detection)
5. discovery.py (module finding)
6. scanner.py (file walking)
7. parsers/ (all 7 language parsers)
8. parser.py (dispatcher)
9. generator.py (output writing)
10. main.py (orchestration)
11. tests/ (all test files)

---

## 12. Appendix

### Regex Pattern Examples

**Kotlin class detection:**
```regex
^(?:(?:public|private|internal|abstract|open|data|sealed)\s+)*class\s+(\w+)
```

**Python function detection:**
```regex
^(\s*)(?:async\s+)?def\s+(\w+)\s*\(
```

**Go function detection:**
```regex
^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(
```

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
| 3 | Class Diagram | [class-diagram.png](diagrams/class-diagram.png) | [class-diagram.drawio](diagrams/class-diagram.drawio) |
