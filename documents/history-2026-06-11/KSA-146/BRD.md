# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-146: [Tree-sitter] TypeScript/JavaScript Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-146 |
| Title | [Tree-sitter] TypeScript/JavaScript Parser |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-28 | BA Agent | Initial document — auto-generated from Jira ticket KSA-146 |

---

## 1. Introduction

### 1.1 Scope

Implement tree-sitter parser for TypeScript/JavaScript that extracts:
- **Symbols**: functions (regular, arrow, async, generator), classes, interfaces, type aliases, enums, imports/exports, JSX/TSX components
- **Relationships**: calls, imports, inheritance (extends/implements)

This is the first language-specific parser built on the tree-sitter core infrastructure (KSA-145). It serves as the reference implementation for other language parsers.

### 1.2 Out of Scope

- Tree-sitter core infrastructure (KSA-145 — prerequisite)
- Python, Kotlin, Java, Go, Rust parsers (separate tickets)
- Graph storage (KSA-153 — parallel work)
- Call graph query tools (KSA-154)
- Complexity analysis (separate ticket)
- JSX/TSX rendering or component tree analysis

### 1.3 Preliminary Requirements

- Tree-sitter core integration complete (KSA-145)
- `tree-sitter-typescript` and `tree-sitter-javascript` grammar packages installed
- Base `TreeSitterParser` interface available from KSA-145

---

## 2. Business Requirements

### 2.1 High Level Process Map

Current regex extraction for TypeScript/JavaScript captures only 6 patterns (function, class, interface, type, enum, arrow fn) with names only. The tree-sitter parser will extract:
- Full symbol metadata (params, return types, generics, modifiers)
- All relationship types (who calls whom, what imports what, inheritance chains)
- JSX/TSX component detection
- Export analysis (what's public API vs internal)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a developer, I want all TypeScript symbol types extracted with full metadata | MUST HAVE | KSA-146 |
| 2 | As a developer, I want function call relationships extracted so call graphs work | MUST HAVE | KSA-146 |
| 3 | As a developer, I want import/export relationships extracted for dependency analysis | MUST HAVE | KSA-146 |
| 4 | As a developer, I want class inheritance relationships (extends/implements) extracted | MUST HAVE | KSA-146 |
| 5 | As a developer, I want JSX/TSX component detection for React codebases | SHOULD HAVE | KSA-146 |
| 6 | As a developer, I want arrow functions and async generators properly handled | MUST HAVE | KSA-146 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Indexer encounters a `.ts`, `.tsx`, `.js`, or `.jsx` file

**Step 2:** Grammar registry (KSA-145) loads `tree-sitter-typescript` or `tree-sitter-javascript`

**Step 3:** File is parsed into AST

**Step 4:** TypeScript parser walks AST extracting symbols (functions, classes, interfaces, etc.)

**Step 5:** TypeScript parser walks AST extracting relationships (calls, imports, inheritance)

**Step 6:** Symbols stored in `symbols` table, relationships in `relationships` table (KSA-153)

---

#### STORY 1: TypeScript Symbol Extraction

> As a developer, I want all TypeScript symbol types extracted with full metadata so AI agents understand the codebase structure.

**Symbol Types to Extract:**

| Symbol Type | AST Node Type | Metadata Extracted |
|-------------|---------------|-------------------|
| Function declaration | `function_declaration` | name, params, return_type, async, generator, exported |
| Arrow function | `arrow_function` (in variable_declarator) | name (from variable), params, return_type, async |
| Method | `method_definition` | name, params, return_type, static, async, accessor |
| Class | `class_declaration` | name, extends, implements, abstract, exported |
| Interface | `interface_declaration` | name, extends, exported |
| Type alias | `type_alias_declaration` | name, type_parameters, exported |
| Enum | `enum_declaration` | name, const, exported, members |
| Variable (const/let) | `variable_declarator` | name, type_annotation, exported |
| Namespace/Module | `module_declaration` | name, exported |
| Constructor | `constructor` (in class) | params |

**Acceptance Criteria:**

1. All 10 symbol types correctly extracted from TypeScript files
2. Parameters include names and type annotations
3. Return types captured where annotated
4. Modifiers (async, static, abstract, export, const) captured
5. Generic type parameters captured (e.g., `<T extends Base>`)
6. Nested symbols have correct parent_symbol_id

---

#### STORY 2: Function Call Extraction

> As a developer, I want function call relationships extracted so that call graph tools can show who calls whom.

**Call Patterns to Detect:**

| Pattern | Example | Extracted As |
|---------|---------|-------------|
| Direct call | `foo()` | calls → `foo` |
| Method call | `obj.method()` | calls → `obj.method` |
| Chained call | `a.b().c()` | calls → `a.b`, calls → `[result].c` |
| Constructor | `new Foo()` | calls → `Foo.constructor` |
| Super call | `super.method()` | calls → `[parent].method` |
| Callback | `arr.map(fn)` | calls → `arr.map`, uses → `fn` |
| Await | `await fetch()` | calls → `fetch` |

**Acceptance Criteria:**

1. Direct function calls detected with correct target symbol name
2. Method calls include object qualifier (e.g., `this.method`, `service.call`)
3. Constructor calls (`new X()`) detected
4. Calls within function bodies correctly attributed to the containing function
5. At least 80% of call patterns in typical TypeScript code detected

---

#### STORY 3: Import/Export Extraction

> As a developer, I want import/export relationships extracted for dependency analysis.

**Import Patterns:**

| Pattern | Example | Extracted As |
|---------|---------|-------------|
| Named import | `import { foo } from './bar'` | imports → `./bar.foo` |
| Default import | `import Bar from './bar'` | imports → `./bar.default` |
| Namespace import | `import * as bar from './bar'` | imports → `./bar.*` |
| Side-effect import | `import './styles.css'` | imports → `./styles.css` |
| Dynamic import | `import('./module')` | imports → `./module` (dynamic) |
| Re-export | `export { foo } from './bar'` | imports → `./bar.foo`, exports → `foo` |

**Acceptance Criteria:**

1. All import patterns correctly detected with source module path
2. Named imports list individual imported symbols
3. Dynamic imports detected with `dynamic: true` metadata
4. Re-exports create both import and export relationships
5. Relative paths preserved as-is (resolution is separate concern)

---

#### STORY 4: Inheritance Extraction

> As a developer, I want class inheritance relationships (extends/implements) extracted for type hierarchy analysis.

**Patterns:**

| Pattern | Example | Extracted As |
|---------|---------|-------------|
| Class extends | `class Dog extends Animal` | inherits → `Animal` |
| Class implements | `class Service implements IService` | implements → `IService` |
| Interface extends | `interface Admin extends User` | inherits → `User` |
| Multiple implements | `class X implements A, B` | implements → `A`, implements → `B` |
| Generic extends | `class List<T extends Comparable>` | inherits → `Comparable` (type param) |

**Acceptance Criteria:**

1. `extends` relationships detected for classes and interfaces
2. `implements` relationships detected for classes
3. Multiple inheritance targets (implements A, B) each create separate edges
4. Generic type constraints detected as relationships

---

#### STORY 5: JSX/TSX Component Detection

> As a developer, I want JSX/TSX component detection for React codebases.

**Acceptance Criteria:**

1. Function components (returning JSX) detected as `component` kind
2. Class components (extending React.Component) detected as `component` kind
3. JSX element usage creates `uses` relationship to the component
4. Props interface/type linked to component via `uses` relationship

---

#### STORY 6: Arrow Functions and Async Generators

> As a developer, I want arrow functions and async generators properly handled as first-class symbols.

**Acceptance Criteria:**

1. Arrow functions assigned to variables extracted with variable name
2. Arrow functions as class properties extracted with property name
3. Async functions marked with `is_async: true`
4. Generator functions marked with `is_generator: true` in metadata
5. Async generators (both flags) correctly handled

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Tree-sitter core (KSA-145) | System | KSA-145 | Base parser infrastructure |
| tree-sitter-typescript | External | N/A | TypeScript grammar package |
| tree-sitter-javascript | External | N/A | JavaScript grammar package |
| Graph data model (KSA-153) | System | KSA-153 | Relationships table for storing edges |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve extraction scope |
| Developer | Code Intelligence Team | Implement TS/JS parser |
| QA | QA Team | Verify extraction accuracy |
| Users | AI Agent developers | Consume enriched TS/JS data |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Complex TypeScript syntax not fully covered | Medium | Medium | Iterative improvement, test with real codebases |
| tree-sitter-typescript grammar bugs | Medium | Low | Pin version, report upstream |
| Performance with large TS files (>5K lines) | Low | Medium | Benchmark, optimize hot paths |
| JSX/TSX parsing edge cases | Low | Medium | Focus on common patterns first |

### 5.2 Assumptions

- tree-sitter-typescript grammar covers TypeScript 5.x syntax
- Call detection at 80% accuracy is acceptable for v1 (improve iteratively)
- Unresolved imports (external packages) stored as string references
- JSX component detection is best-effort (not 100% accurate)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Parse + extract <15ms per file | For files under 1000 lines |
| Accuracy | Symbol extraction >95% | Compared to manual analysis |
| Accuracy | Call detection >80% | For direct and method calls |
| Accuracy | Import detection >99% | Import patterns are well-defined |
| Coverage | TypeScript 5.x syntax | Including decorators, satisfies, etc. |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-146 | [Tree-sitter] TypeScript/JavaScript Parser | To Do | Task | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | To Do | Epic | Parent epic |
| KSA-145 | [Tree-sitter] Core Integration | To Do | Task | Prerequisite |
| KSA-153 | [Graph] Data Model & Storage | To Do | Task | Storage for relationships |
| KSA-154 | [Graph] Call Graph | To Do | Task | Consumes call relationships |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| AST | Abstract Syntax Tree — parsed representation of source code |
| Arrow function | `const fn = () => {}` — anonymous function expression |
| JSX/TSX | JavaScript/TypeScript XML — React component syntax |
| Generator | Function that yields values (`function*`) |
| Type alias | `type Foo = ...` — named type definition |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| tree-sitter-typescript | https://github.com/tree-sitter/tree-sitter-typescript |
| TypeScript AST Explorer | https://ts-ast-viewer.com/ |
