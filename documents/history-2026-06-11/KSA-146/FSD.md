# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-146: [Tree-sitter] TypeScript/JavaScript Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-146 |
| Title | [Tree-sitter] TypeScript/JavaScript Parser |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-146.docx |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the TypeScript/JavaScript language parser implementation using tree-sitter. It defines which AST node types map to symbols, how relationships are extracted, and the handling of TypeScript-specific syntax.

### 1.2 Scope

- TypeScript symbol extraction (all symbol types)
- JavaScript symbol extraction (subset of TypeScript)
- Call relationship extraction
- Import/export relationship extraction
- Inheritance relationship extraction (extends/implements)
- JSX/TSX component detection

---

## 2. System Overview

### 2.1 Parser Architecture

```
TypeScriptParser implements ILanguageParser
    │
    ├── SymbolExtractor (walks AST for symbols)
    │     ├── FunctionExtractor
    │     ├── ClassExtractor
    │     ├── InterfaceExtractor
    │     └── VariableExtractor
    │
    └── RelationshipExtractor (walks AST for edges)
          ├── CallExtractor
          ├── ImportExtractor
          └── InheritanceExtractor
```

---

## 3. Functional Requirements

### 3.1 Feature: Symbol Extraction

#### 3.1.1 AST Node Type Mapping

| TypeScript Construct | AST Node Type | Extracted Kind | Example |
|---------------------|---------------|----------------|---------|
| `function foo()` | `function_declaration` | `function` | `function parseConfig(path: string): Config` |
| `const foo = () =>` | `variable_declarator` + `arrow_function` | `function` | `const handler = async (req) => {}` |
| `class Foo` | `class_declaration` | `class` | `class UserService extends BaseService` |
| `interface IFoo` | `interface_declaration` | `interface` | `interface IRepository<T>` |
| `type Foo =` | `type_alias_declaration` | `type` | `type Result<T> = Success<T> \| Error` |
| `enum Foo` | `enum_declaration` | `enum` | `enum Status { Active, Inactive }` |
| `method()` | `method_definition` | `method` | `async getData(): Promise<Data[]>` |
| `constructor()` | `method_definition` (name=constructor) | `constructor` | `constructor(private db: Database)` |
| `get/set prop` | `method_definition` (get/set) | `property` | `get name(): string` |
| `namespace Foo` | `module` (internal_module) | `namespace` | `namespace Utils { ... }` |

#### 3.1.2 Use Case: Extract Function

**Use Case ID:** UC-01 — Extract Function Declaration

**Main Flow:**

| Step | Action | Output |
|------|--------|--------|
| 1 | Find `function_declaration` node | Node reference |
| 2 | Get `name` child → symbol name | `"parseConfig"` |
| 3 | Get `formal_parameters` → parameters | `"(path: string, options?: Options)"` |
| 4 | Get `return_type` child → return type | `"Config"` |
| 5 | Check for `async` keyword → is_async | `true` |
| 6 | Check for `export` keyword → is_exported | `true` |
| 7 | Get preceding comment → doc_comment | `"/** Parses config file */"` |
| 8 | Get node range → start_line, end_line | `10, 45` |
| 9 | Build signature string | `"async function parseConfig(path: string, options?: Options): Config"` |

**Alternative Flow — Arrow Function:**

| Step | Action | Output |
|------|--------|--------|
| 1 | Find `variable_declarator` with `arrow_function` value | Node |
| 2 | Get variable name (from declarator) | `"handler"` |
| 3 | Get parameters from arrow_function | `"(req: Request, res: Response)"` |
| 4 | Get return type (if annotated on variable) | `"void"` |
| 5 | Check parent for `export` | `true/false` |

#### 3.1.3 Use Case: Extract Class

**Use Case ID:** UC-02 — Extract Class with Members

| Step | Action | Output |
|------|--------|--------|
| 1 | Find `class_declaration` node | Node |
| 2 | Get `name` child | `"UserService"` |
| 3 | Get `class_heritage` → extends/implements | `extends BaseService implements IService` |
| 4 | Get `type_parameters` → generics | `"<T extends Entity>"` |
| 5 | Check for `abstract` keyword | `false` |
| 6 | For each `method_definition` child → extract as method | Methods with parent_symbol_id |
| 7 | For each `public_field_definition` → extract as property | Properties |

---

### 3.2 Feature: Call Relationship Extraction

#### 3.2.1 Call Detection Patterns

| AST Node Type | Pattern | Example | Target Symbol |
|---------------|---------|---------|---------------|
| `call_expression` | `identifier(args)` | `parseConfig(path)` | `parseConfig` |
| `call_expression` | `member_expression(args)` | `this.validate(data)` | `this.validate` |
| `call_expression` | `member_expression(args)` | `service.getUser(id)` | `service.getUser` |
| `new_expression` | `new identifier(args)` | `new UserService(db)` | `UserService.constructor` |
| `call_expression` | `await expression(args)` | `await fetch(url)` | `fetch` |

#### 3.2.2 Use Case: Extract Calls from Function Body

**Use Case ID:** UC-03 — Extract Call Relationships

| Step | Action | Output |
|------|--------|--------|
| 1 | For each function/method symbol extracted | Source symbol ID |
| 2 | Find all `call_expression` nodes within body | Call nodes |
| 3 | For each call, resolve target name | Target symbol string |
| 4 | Get line number of call | Line number |
| 5 | Create relationship: {source, target, kind='calls', line} | Relationship |

**Target Name Resolution:**

| Call Pattern | Resolution Strategy | Example |
|-------------|--------------------|---------| 
| `foo()` | Use identifier directly | target = `"foo"` |
| `obj.method()` | Use `object.property` | target = `"obj.method"` |
| `this.method()` | Use `ClassName.method` (from parent class) | target = `"UserService.validate"` |
| `super.method()` | Use `ParentClass.method` | target = `"BaseService.method"` |
| `a.b.c()` | Use full chain | target = `"a.b.c"` |
| `new Foo()` | Use `Foo.constructor` | target = `"Foo.constructor"` |

---

### 3.3 Feature: Import/Export Extraction

#### 3.3.1 Import Patterns

| Import Syntax | AST Structure | Extracted Relationship |
|---------------|---------------|----------------------|
| `import { foo } from './bar'` | `import_statement` → `import_specifier` | imports → `./bar.foo` |
| `import Bar from './bar'` | `import_statement` → `identifier` | imports → `./bar.default` |
| `import * as bar from './bar'` | `import_statement` → `namespace_import` | imports → `./bar.*` |
| `import './styles.css'` | `import_statement` (no specifiers) | imports → `./styles.css` |
| `const x = require('./bar')` | `call_expression` (require) | imports → `./bar` |
| `import('./module')` | `call_expression` (dynamic import) | imports → `./module` (dynamic) |

#### 3.3.2 Export Patterns

| Export Syntax | Extracted |
|---------------|-----------|
| `export function foo()` | Symbol marked `is_exported = true` |
| `export default class Bar` | Symbol marked `is_exported = true` |
| `export { foo, bar }` | Referenced symbols marked exported |
| `export { foo } from './bar'` | Re-export: import + export |

---

### 3.4 Feature: Inheritance Extraction

#### 3.4.1 Patterns

| Syntax | Relationship Kind | Target |
|--------|------------------|--------|
| `class Dog extends Animal` | `inherits` | `Animal` |
| `class Service implements IService` | `implements` | `IService` |
| `class Service implements A, B` | `implements` × 2 | `A`, `B` |
| `interface Admin extends User` | `inherits` | `User` |
| `interface Admin extends User, Serializable` | `inherits` × 2 | `User`, `Serializable` |

---

### 3.5 Feature: JSX/TSX Handling

#### 3.5.1 Component Detection

| Pattern | Detection | Kind |
|---------|-----------|------|
| Function returning JSX | Check if return type contains `jsx_element` | `component` |
| `React.FC<Props>` type | Check type annotation | `component` |
| Class extending `React.Component` | Check heritage clause | `component` |

#### 3.5.2 JSX Usage as Relationship

| JSX Pattern | Relationship |
|-------------|-------------|
| `<UserCard />` | uses → `UserCard` |
| `<Modal.Header>` | uses → `Modal.Header` |

---

## 4. Non-Functional Requirements

| Category | Target | Notes |
|----------|--------|-------|
| Parse speed | ≤15ms per file (1000 lines) | Including symbol + relationship extraction |
| Symbol accuracy | >95% | Compared to manual analysis |
| Call detection | >80% | Direct + method calls |
| Import detection | >99% | Well-defined syntax |
| Memory | ≤100MB for parser + grammar | Shared across files |

---

## 5. Error Handling

| Scenario | Handling |
|----------|----------|
| Syntax error in source file | tree-sitter provides partial AST — extract what's possible |
| Unresolved type (generic, external) | Store as string, don't fail |
| Circular imports | Store both directions, no loop detection needed |
| Very large file (>10K lines) | Parse normally (tree-sitter handles it), warn if >50ms |

---

## 6. Test Strategy

| Test Type | Coverage |
|-----------|----------|
| Unit tests | Each extractor (function, class, import, call) |
| Fixture tests | Real TypeScript files with known symbols |
| Accuracy tests | Compare extraction vs manual count |
| Performance tests | Benchmark with 100/500/1000 line files |
| Edge cases | Decorators, generics, overloads, ambient declarations |
