# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-147: [Tree-sitter] Kotlin Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-147 |
| Title | [Tree-sitter] Kotlin Parser |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |
| Priority | Highest |
| Estimate | 0.5 week |

---

## 1. Executive Summary

Implement a tree-sitter based parser for Kotlin language within the MCP Code Intelligence server. This parser will extract rich symbol information (classes, interfaces, objects, data/sealed/enum classes, suspend functions, packages) and relationships (calls, imports, inheritance, implementations) from Kotlin source files, replacing the current regex-based extraction that only captures symbol names without any structural or relational data.

---

## 2. Business Context

### 2.1 Problem Statement

The current regex-based Kotlin extraction captures only 5 basic patterns (fun, class, interface, object, enum class) without parameters, return types, modifiers, parent-child relationships, or call/import relationships. This makes the code intelligence tools unable to provide call graphs, dependency analysis, or impact analysis for Kotlin codebases.

### 2.2 Business Drivers

- **Code Intelligence v2 Epic (KSA-144):** Kotlin parser is a prerequisite for graph engine features (KSA-155, KSA-156) to work on Kotlin projects
- **Primary language support:** Kotlin is the primary language of the FEC CR Builder server itself
- **Developer productivity:** Rich Kotlin parsing enables accurate refactoring suggestions, impact analysis, and AI context generation

### 2.3 Dependencies

| Dependency | Ticket | Status |
|-----------|--------|--------|
| Core tree-sitter integration | KSA-145 | Done |
| TypeScript/JS parser (reference implementation) | KSA-146 | Done |
| Graph data model | KSA-153 | Done |

---

## 3. Stakeholders

| Role | Interest |
|------|----------|
| AI Agents (DEV, SA, QA) | Accurate Kotlin symbol data for code analysis |
| Developers | Better code navigation, refactoring support |
| Product Owner | Feature parity with CodeGraph for Kotlin |

---

## 4. Requirements

### 4.1 Functional Requirements

#### FR-1: Symbol Extraction

The Kotlin parser MUST extract the following symbol types with full metadata:

| Symbol Type | Metadata Extracted |
|-------------|-------------------|
| Classes (regular, data, sealed, enum, abstract, open) | Name, modifiers, type parameters, primary constructor params, superclass, interfaces |
| Interfaces | Name, type parameters, methods, default implementations |
| Objects (singleton, companion) | Name, parent class, members |
| Functions (regular, suspend, extension, operator, infix, inline) | Name, parameters with types, return type, receiver type, modifiers |
| Properties (val, var, const, lateinit) | Name, type, modifiers, getter/setter |
| Enum entries | Name, constructor args |
| Type aliases | Name, target type |
| Packages | Package declaration |

#### FR-2: Relationship Extraction

| Relationship | Description |
|-------------|-------------|
| calls | Function/method invocations (including extension function calls) |
| imports | Import statements (single, wildcard, alias) |
| inherits | Class extends class |
| implements | Class implements interface |
| uses | Type references in parameters, return types, properties |
| decorates | Annotations on classes/functions/properties |

#### FR-3: Kotlin-Specific Features

| Feature | Requirement |
|---------|-------------|
| Suspend functions | Mark `isAsync = true` for suspend functions |
| Extension functions | Capture receiver type in metadata |
| Data classes | Extract `copy()`, `equals()`, `hashCode()`, `toString()` as implicit methods |
| Sealed classes | Extract permitted subclasses |
| Companion objects | Link to parent class |
| Coroutine builders | Detect `launch`, `async`, `runBlocking` as call relationships |
| DSL builders | Detect lambda-with-receiver patterns |
| Operator overloading | Map operator functions to standard names |

#### FR-4: Complexity Calculation

Calculate cyclomatic complexity for Kotlin functions based on:
- `if`, `else if`, `when` branches, `for`, `while`, `do-while`
- `&&`, `||` operators
- `catch` blocks
- `?.` safe calls (optional: count as branch)

#### FR-5: Performance Requirements

| Metric | Target |
|--------|--------|
| Single file parse time | < 15ms for files up to 1000 lines |
| Batch indexing (100 files) | < 3 seconds |
| Memory per parser instance | < 10MB |

### 4.2 Non-Functional Requirements

| NFR | Requirement |
|-----|-------------|
| Compatibility | Node.js >= 18, tree-sitter 0.21.x |
| Fallback | If tree-sitter-kotlin grammar fails to load, fall back to regex extraction |
| Error tolerance | Partial AST from syntax errors must still extract valid symbols |
| Testing | >= 90% code coverage for parser logic |

---

## 5. User Stories

### STORY-1: As an AI agent, I want to find all callers of a Kotlin function so I can assess impact of changes

**Acceptance Criteria:**
- Given a Kotlin file with function calls, when indexed, then `code_callers` tool returns accurate caller list
- Given a suspend function, when indexed, then it is marked as async in the symbol table
- Given an extension function `String.toSlug()`, when indexed, then the receiver type "String" is captured

### STORY-2: As an AI agent, I want to see class hierarchies in Kotlin so I can understand inheritance

**Acceptance Criteria:**
- Given a sealed class with subclasses, when indexed, then inheritance relationships are captured
- Given a class implementing multiple interfaces, when indexed, then all `implements` relationships exist
- Given a data class, when indexed, then generated methods are listed

### STORY-3: As an AI agent, I want import relationships from Kotlin files so I can build dependency graphs

**Acceptance Criteria:**
- Given `import com.example.Service`, when indexed, then an `imports` relationship is created
- Given `import com.example.*`, when indexed, then a wildcard import relationship is created
- Given `import com.example.Foo as Bar`, when indexed, then alias metadata is captured

---

## 6. Acceptance Criteria (Summary)

| # | Criterion | Priority |
|---|-----------|----------|
| AC-1 | All 8 symbol types extracted with full metadata | Critical |
| AC-2 | All 6 relationship types extracted | Critical |
| AC-3 | Suspend functions marked as async | High |
| AC-4 | Extension function receiver types captured | High |
| AC-5 | Cyclomatic complexity calculated | High |
| AC-6 | Single file parse < 15ms | High |
| AC-7 | Graceful fallback on grammar load failure | Medium |
| AC-8 | Partial extraction from files with syntax errors | Medium |

---

## 7. Out of Scope

- Kotlin Multiplatform (KMP) expect/actual resolution
- Kotlin Script (.kts) files (build scripts)
- Kotlin/Native specific constructs
- Cross-file type resolution (handled by graph engine)
- IDE-level completion/diagnostics

---

## 8. Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| tree-sitter-kotlin grammar incomplete | Some constructs not parsed | Contribute fixes upstream, regex fallback for gaps |
| Native binding compilation on CI | Build failures | Pre-built binaries, Docker build environment |
| Performance regression on large files | Slow indexing | Benchmark suite, file size limits |
