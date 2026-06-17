# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-148: [Tree-sitter] Python Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-148 |
| Title | [Tree-sitter] Python Parser |
| Author | BA + TA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-148.docx |

---

## 1. Overview

Python parser module implementing `ILanguageParser` interface (KSA-145). Uses tree-sitter-python grammar for AST-based extraction of symbols and relationships from Python source files.

---

## 2. Use Cases

### UC-1: Parse Python File

**Main Flow:**
1. TreeSitterIndexer receives `.py` file
2. GrammarRegistry returns PythonParser
3. Parser generates AST, walks tree extracting symbols
4. Extracts relationships (calls, imports, inheritance)
5. Calculates complexity for each function/method
6. Returns ParseResult

**Alternative Flow — Syntax Error:**
1. File has IndentationError or SyntaxError
2. tree-sitter returns partial AST
3. Parser extracts from valid subtrees
4. Reports errors in ParseResult.errors[]

### UC-2: Extract Python Imports

**Main Flow:**
1. Parser finds `import_statement` and `import_from_statement` nodes
2. For `import os`: creates { kind: "imports", target: "os" }
3. For `from pathlib import Path`: creates { kind: "imports", target: "pathlib.Path", metadata: { from: "pathlib", name: "Path" } }
4. For `from . import utils`: creates { kind: "imports", target: ".utils", metadata: { relative: true, level: 1 } }
5. For `from ..core import Base`: creates { kind: "imports", target: "..core.Base", metadata: { relative: true, level: 2 } }

### UC-3: Extract Class with Decorators and Inheritance

**Main Flow:**
1. Parser finds `class_definition` node
2. Extracts decorators from `decorator` children
3. Extracts base classes from `argument_list` after class name
4. Detects Protocol/ABC patterns
5. Extracts methods with their decorators (@property, @staticmethod, etc.)
6. Creates inheritance/implements relationships

---

## 3. Detailed Specifications

### 3.1 AST Node Type Mapping

| Python Construct | tree-sitter Node Type | Symbol Kind |
|-----------------|----------------------|-------------|
| Function | `function_definition` | function |
| Async function | `function_definition` with `async` keyword | function (isAsync=true) |
| Class | `class_definition` | class |
| Method | `function_definition` inside class body | method |
| Property | method with `@property` decorator | property |
| Module variable | `assignment` at module level | variable |
| Type alias | `type_alias_statement` (3.12+) or `assignment` with `TypeAlias` | type |
| Decorator | `decorator` | (relationship only) |

### 3.2 Decorator Extraction

```python
@app.route("/api", methods=["GET"])
def handler():
    pass
```

AST: `decorated_definition` -> `decorator` -> `call` (or `attribute`)

Output:
- Symbol: `handler` with `decorators: ["app.route"]`
- Relationship: { kind: "decorates", sourceSymbol: "handler", targetSymbol: "app.route", metadata: { args: ["/api"] } }

### 3.3 Import Extraction Rules

| Python Import | Relationship Output |
|--------------|-------------------|
| `import os` | { target: "os", kind: "imports" } |
| `import os.path` | { target: "os.path", kind: "imports" } |
| `import os as operating_system` | { target: "os", kind: "imports", metadata: { alias: "operating_system" } } |
| `from pathlib import Path` | { target: "pathlib.Path", kind: "imports", metadata: { from: "pathlib" } } |
| `from pathlib import Path, PurePath` | 2 relationships |
| `from pathlib import *` | { target: "pathlib.*", kind: "imports", metadata: { wildcard: true } } |
| `from . import utils` | { target: ".utils", kind: "imports", metadata: { relative: true, level: 1 } } |
| `from ..core import Base` | { target: "..core.Base", kind: "imports", metadata: { relative: true, level: 2 } } |

### 3.4 Protocol/ABC Detection

**Protocol detection:**
- Class inherits from `Protocol` (from `typing` module)
- Mark as `kind: "interface"`
- Methods become interface method signatures

**ABC detection:**
- Class inherits from `ABC` or uses `metaclass=ABCMeta`
- Methods with `@abstractmethod` marked with `modifiers: ["abstract"]`

### 3.5 Complexity Calculation

```
complexity = 1
for each node in function body:
  if node.type in ["if_statement", "elif_clause", "for_statement",
                    "while_statement", "except_clause", "with_statement",
                    "case_clause", "assert_statement"]:
    complexity++
  if node.type == "boolean_operator":  // and, or
    complexity++
  if node.type == "conditional_expression":  // ternary
    complexity++
  if node.type == "list_comprehension", "set_comprehension",
     "dictionary_comprehension", "generator_expression":
    complexity++  // implicit loop
```

### 3.6 Type Hint Extraction

```python
def process(items: list[str], count: int = 10) -> dict[str, Any]:
```

Output:
```json
{
  "name": "process",
  "parameters": "items: list[str], count: int = 10",
  "returnType": "dict[str, Any]",
  "signature": "def process(items: list[str], count: int = 10) -> dict[str, Any]"
}
```

### 3.7 Dataclass Detection

```python
@dataclass
class User:
    name: str
    age: int = 0
```

- Detect `@dataclass` decorator
- Extract annotated assignments as fields (kind: "property")
- Generate implicit `__init__`, `__repr__`, `__eq__` symbols

### 3.8 Call Extraction

| Call Pattern | Target |
|-------------|--------|
| `foo()` | "foo" |
| `self.method()` | "method" (metadata: { receiver: "self" }) |
| `cls.create()` | "create" (metadata: { receiver: "cls" }) |
| `module.func()` | "func" (metadata: { receiver: "module" }) |
| `ClassName()` | "ClassName" (metadata: { isConstructor: true }) |
| `super().__init__()` | "__init__" (metadata: { receiver: "super" }) |

---

## 4. Grammar Configuration

```json
{
  "id": "python",
  "extensions": [".py", ".pyi"],
  "grammarPackage": "tree-sitter-python",
  "parserModule": "./languages/python-parser"
}
```

---

## 5. Error Handling

| Scenario | Behavior |
|----------|----------|
| IndentationError | tree-sitter partial AST, extract what's valid |
| Missing type hints | Parameters extracted without types |
| Dynamic decorators | Extract name only, skip complex expressions |
| Star imports | Create wildcard relationship |
| Nested functions | Extract with parentName set to enclosing function |

---

## 6. Integration Points

| Component | Interface | Direction |
|-----------|-----------|-----------|
| GrammarRegistry (KSA-145) | `getParser(".py")` -> PythonParser | Consumed |
| TreeSitterIndexer (KSA-145) | `parser.parse(source, filePath)` -> ParseResult | Provided |
| GraphRepository (KSA-153) | Stores relationships | Downstream |
| DependencyGraph (KSA-155) | Uses import relationships | Downstream |
| ImpactAnalysis (KSA-156) | Uses all relationships | Downstream |

---

## 7. Test Scenarios

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| T-1 | Simple function | `def foo(x: int) -> str:` | Function with params + return type |
| T-2 | Async function | `async def fetch():` | isAsync = true |
| T-3 | Class with inheritance | `class Foo(Bar, Baz):` | 2 inherits relationships |
| T-4 | Protocol class | `class IRepo(Protocol):` | kind = "interface" |
| T-5 | Decorators | `@app.route("/")` | decorates relationship |
| T-6 | All import types | 6 import patterns | 6 import relationships |
| T-7 | Dataclass | `@dataclass class User:` | Fields + implicit methods |
| T-8 | Property | `@property def name(self):` | kind = "property" |
| T-9 | Nested function | `def outer(): def inner():` | Both extracted, parent-child |
| T-10 | Complexity | Function with 8 branches | complexity = 9 |
