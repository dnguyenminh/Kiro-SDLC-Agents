# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-148: [Tree-sitter] Python Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-148 |
| Title | [Tree-sitter] Python Parser |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |
| Priority | Highest |
| Estimate | 0.5 week |

---

## 1. Executive Summary

Implement a tree-sitter based parser for Python language. Extract: functions, classes, methods, fields, decorators, type hints, async functions, abstract classes, match statements, protocols, and ABC. Extract relationships: calls, imports, inheritance, implementations.

---

## 2. Business Context

### 2.1 Problem Statement

Current regex extraction for Python captures only `def name` and `class name` (2 patterns). Missing: parameters, return types, decorators, type hints, async markers, parent-child relationships, call graphs, import relationships.

### 2.2 Dependencies

| Dependency | Ticket | Status |
|-----------|--------|--------|
| Core tree-sitter integration | KSA-145 | Done |
| TypeScript parser (reference) | KSA-146 | Done |
| Graph data model | KSA-153 | Done |

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1: Symbol Extraction

| Symbol Type | Metadata Extracted |
|-------------|-------------------|
| Functions (regular, async, generator) | Name, parameters with type hints, return type, decorators, is_async |
| Classes (regular, abstract, dataclass, Protocol) | Name, bases, metaclass, decorators, methods |
| Methods (regular, classmethod, staticmethod, property) | Name, self/cls param, type hints, decorators |
| Fields/Attributes | Name, type annotation, default value |
| Decorators | Name, arguments |
| Type aliases | Name, target type |
| Module-level variables | Name, type annotation |
| Match statements (3.10+) | Pattern cases as branches for complexity |

#### FR-2: Relationship Extraction

| Relationship | Description |
|-------------|-------------|
| calls | Function/method calls, constructor calls |
| imports | `import x`, `from x import y`, relative imports |
| inherits | Class base classes |
| implements | Protocol/ABC implementations (heuristic) |
| uses | Type annotations referencing other symbols |
| decorates | Decorator usage on functions/classes |

#### FR-3: Python-Specific Features

| Feature | Requirement |
|---------|-------------|
| Async functions | Mark `isAsync = true` for `async def` |
| Decorators | Full decorator chain extraction with arguments |
| Type hints (PEP 484) | Extract from annotations, `->` return type |
| Protocols (PEP 544) | Detect `Protocol` base class, mark as interface |
| ABC | Detect `ABC`/`ABCMeta`, mark abstract methods |
| Dataclasses | Detect `@dataclass`, extract fields from `__init__` |
| Properties | Detect `@property`, `@x.setter`, `@x.deleter` |
| `__all__` | Detect exported symbols list |
| Dunder methods | Extract `__init__`, `__str__`, etc. with special handling |
| Match/case (3.10+) | Count cases for complexity |

#### FR-4: Performance

| Metric | Target |
|--------|--------|
| Single file parse | < 10ms for 1000 lines |
| 1000 files batch | < 10 seconds |

### 3.2 Non-Functional Requirements

| NFR | Requirement |
|-----|-------------|
| Compatibility | Node.js >= 18, tree-sitter-python grammar |
| Fallback | Regex extraction if grammar unavailable |
| Error tolerance | Partial extraction from files with IndentationError |

---

## 4. User Stories

### STORY-1: As an AI agent, I want complete Python function signatures so I can generate accurate code

**Acceptance Criteria:**
- Parameters with type hints extracted
- Return type extracted
- Decorators captured
- Async functions marked

### STORY-2: As an AI agent, I want Python import graphs so I can understand module dependencies

**Acceptance Criteria:**
- `import os` -> imports relationship
- `from pathlib import Path` -> imports relationship with metadata
- `from . import sibling` -> relative import captured

### STORY-3: As an AI agent, I want Python class hierarchies including Protocols and ABCs

**Acceptance Criteria:**
- `class Foo(Bar, Baz):` -> inherits Bar, inherits Baz
- `class IFoo(Protocol):` -> marked as interface
- `class Base(ABC):` with `@abstractmethod` -> abstract methods marked

---

## 5. Acceptance Criteria (Summary)

| # | Criterion | Priority |
|---|-----------|----------|
| AC-1 | All symbol types extracted with type hints | Critical |
| AC-2 | All relationship types extracted | Critical |
| AC-3 | Async functions marked | High |
| AC-4 | Decorators fully captured | High |
| AC-5 | Protocol/ABC detection | High |
| AC-6 | Complexity calculation | High |
| AC-7 | < 10ms per file | High |
| AC-8 | Partial extraction on syntax errors | Medium |

---

## 6. Out of Scope

- Runtime type inference (only static annotations)
- Cross-file import resolution
- Virtual environment package analysis
- Jupyter notebook (.ipynb) parsing
