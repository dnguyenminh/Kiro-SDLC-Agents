# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-151: [Tree-sitter] Rust Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-151 |
| Title | [Tree-sitter] Rust Parser |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-01 | BA Agent | Initial document — auto-generated from Jira ticket KSA-151 |

---

## 1. Introduction

### 1.1 Scope

Implement tree-sitter parser for Rust that extracts:
- **Symbols**: functions, structs, traits, enums, modules, impl blocks, type aliases, constants, macros
- **Relationships**: calls, imports (use), trait implementations, module hierarchy

This parser builds on the tree-sitter core infrastructure (KSA-145) and follows the same architecture as sibling parsers.

### 1.2 Out of Scope

- Tree-sitter core infrastructure (KSA-145 — prerequisite)
- Other language parsers
- Graph storage (KSA-153)
- Macro expansion analysis (compile-time code generation)
- Lifetime/borrow checker analysis
- Unsafe code analysis

### 1.3 Preliminary Requirements

- Tree-sitter core integration complete (KSA-145)
- `tree-sitter-rust` grammar package installed
- Base `TreeSitterParser` interface available from KSA-145

---

## 2. Business Requirements

### 2.1 High Level Process Map

Current regex extraction for Rust captures only 5 patterns (fn, struct, trait, enum, mod) with names only. The tree-sitter parser will extract:
- Full symbol metadata (params with types, return types, generics, lifetimes, visibility)
- All relationship types (calls, use/imports, trait implementations, module nesting)
- Impl block association (methods → struct/trait)
- Derive macro detection

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a developer, I want all Rust symbol types extracted with full metadata | MUST HAVE | KSA-151 |
| 2 | As a developer, I want function call relationships extracted | MUST HAVE | KSA-151 |
| 3 | As a developer, I want `use` (import) relationships extracted | MUST HAVE | KSA-151 |
| 4 | As a developer, I want trait implementation relationships extracted | MUST HAVE | KSA-151 |
| 5 | As a developer, I want impl blocks associated with their target type | MUST HAVE | KSA-151 |
| 6 | As a developer, I want module hierarchy and visibility analysis | SHOULD HAVE | KSA-151 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Indexer encounters a `.rs` file

**Step 2:** Grammar registry (KSA-145) loads `tree-sitter-rust`

**Step 3:** File is parsed into AST

**Step 4:** Rust parser walks AST extracting symbols

**Step 5:** Rust parser walks AST extracting relationships

**Step 6:** Symbols stored in `symbols` table, relationships in `relationships` table (KSA-153)

---

#### STORY 1: Rust Symbol Extraction

> As a developer, I want all Rust symbol types extracted with full metadata.

**Symbol Types to Extract:**

| Symbol Type | AST Node Type | Metadata Extracted |
|-------------|---------------|-------------------|
| Function | `function_item` | name, params, return_type, async, unsafe, const, pub, generics, lifetimes |
| Struct | `struct_item` | name, fields, generics, pub, derive_macros |
| Enum | `enum_item` | name, variants, generics, pub |
| Trait | `trait_item` | name, methods, supertraits, generics, pub, unsafe |
| Impl block | `impl_item` | target_type, trait (if trait impl), methods |
| Module | `mod_item` | name, pub, inline vs file |
| Type alias | `type_item` | name, target_type, generics, pub |
| Constant | `const_item` | name, type, value, pub |
| Static | `static_item` | name, type, mutable, pub |
| Macro | `macro_definition` | name, macro_rules vs proc_macro |

**Acceptance Criteria:**

1. All 10 symbol types correctly extracted from Rust files
2. Function parameters include names, types, and mutability (e.g., `&mut self, id: u64`)
3. Return types captured including `Result<T, E>` and `Option<T>`
4. Visibility modifiers captured (`pub`, `pub(crate)`, `pub(super)`, private)
5. Generic type parameters with trait bounds captured (e.g., `<T: Display + Clone>`)
6. Lifetime parameters captured (e.g., `<'a, 'b: 'a>`)
7. Async, unsafe, const function modifiers captured
8. Derive macros on structs/enums captured (e.g., `#[derive(Debug, Clone, Serialize)]`)

---

#### STORY 2: Function Call Extraction

> As a developer, I want function call relationships extracted.

**Call Patterns to Detect:**

| Pattern | Example | Extracted As |
|---------|---------|-------------|
| Direct call | `foo()` | calls → `foo` |
| Method call | `s.method()` | calls → `[type].method` |
| Associated function | `Vec::new()` | calls → `Vec::new` |
| Trait method | `item.display()` | calls → `[trait].display` |
| Chained call | `iter.map().filter().collect()` | calls → each method |
| Macro invocation | `println!()` | calls → `println` (macro) |
| Closure body | `\|x\| transform(x)` | calls → `transform` |
| Await | `future.await` | calls → `[type].poll` (async) |

**Acceptance Criteria:**

1. Direct function calls detected with module path
2. Method calls include type qualifier when determinable
3. Associated function calls (e.g., `String::from()`) detected
4. Macro invocations detected and marked as `macro: true`
5. Calls within function bodies attributed to containing function
6. At least 80% of call patterns detected

---

#### STORY 3: Use (Import) Extraction

> As a developer, I want `use` relationships extracted for dependency analysis.

**Use Patterns:**

| Pattern | Example | Extracted As |
|---------|---------|-------------|
| Simple use | `use std::io::Read` | imports → `std::io::Read` |
| Glob use | `use std::io::*` | imports → `std::io::*` |
| Grouped use | `use std::{io, fs}` | imports → `std::io`, `std::fs` |
| Nested group | `use std::io::{self, Read, Write}` | imports → `std::io`, `std::io::Read`, `std::io::Write` |
| Aliased use | `use std::io::Result as IoResult` | imports → `std::io::Result` (alias: `IoResult`) |
| Pub use (re-export) | `pub use crate::module::Type` | imports + exports → `crate::module::Type` |

**Acceptance Criteria:**

1. All use patterns correctly detected with full path
2. Grouped/nested uses expanded into individual imports
3. Aliases captured
4. `pub use` creates both import and export relationships
5. `crate::`, `super::`, `self::` prefixes preserved

---

#### STORY 4: Trait Implementation Extraction

> As a developer, I want trait implementation relationships extracted.

**Patterns:**

| Pattern | Example | Extracted As |
|---------|---------|-------------|
| Trait impl | `impl Display for MyStruct` | `MyStruct` implements → `Display` |
| Inherent impl | `impl MyStruct` | methods belong_to → `MyStruct` |
| Generic impl | `impl<T: Clone> From<T> for Wrapper<T>` | `Wrapper` implements → `From` |
| Blanket impl | `impl<T: Display> ToString for T` | blanket_impl → `ToString` for `Display` |
| Derive | `#[derive(Clone, Debug)]` | `MyStruct` implements → `Clone`, `Debug` |

**Acceptance Criteria:**

1. Trait implementations create `implements` relationship
2. Inherent impl methods create `belongs_to` relationship to type
3. Derive macros create `implements` relationships for derived traits
4. Generic trait bounds on impl blocks captured
5. Supertraits (trait inheritance) detected

---

#### STORY 5: Impl Block Association

> As a developer, I want impl blocks associated with their target type.

**Acceptance Criteria:**

1. Methods in `impl MyStruct` blocks linked to `MyStruct` via `belongs_to`
2. Methods in `impl Trait for MyStruct` blocks linked to both struct and trait
3. Associated functions (no `self` param) distinguished from methods
4. Multiple impl blocks for same type merged logically

---

#### STORY 6: Module Hierarchy and Visibility

> As a developer, I want module hierarchy and visibility analysis.

**Acceptance Criteria:**

1. `mod` declarations create module hierarchy (parent → child)
2. Inline modules (`mod foo { ... }`) detected
3. File modules (`mod foo;` → `foo.rs` or `foo/mod.rs`) detected
4. Visibility modifiers determine cross-module accessibility
5. `pub(crate)` and `pub(super)` scoping captured

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Tree-sitter core (KSA-145) | System | KSA-145 | Base parser infrastructure |
| tree-sitter-rust | External | N/A | Rust grammar package |
| Graph data model (KSA-153) | System | KSA-153 | Relationships table |
| KSA-146 (TypeScript parser) | Reference | KSA-146 | Architecture reference |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve extraction scope |
| Developer | Code Intelligence Team | Implement Rust parser |
| QA | QA Team | Verify extraction accuracy |
| Users | AI Agent developers | Consume enriched Rust data |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Macro-heavy code not fully analyzable | Medium | High | Mark macro invocations, skip expansion |
| Complex lifetime annotations | Low | Medium | Capture as strings, don't validate |
| Procedural macros generate invisible code | Medium | Medium | Document limitation, future enhancement |
| Large Rust files with many impl blocks | Low | Medium | Efficient traversal, batch processing |

### 5.2 Assumptions

- tree-sitter-rust grammar covers Rust 2021 edition syntax
- Macro expansion is out of scope (only invocation sites detected)
- Lifetime analysis is informational only (no borrow checking)
- Blanket impls are detected but not resolved to concrete types

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Parse + extract <15ms per file | For files under 1000 lines |
| Accuracy | Symbol extraction >95% | Compared to manual analysis |
| Accuracy | Call detection >80% | For direct and method calls |
| Accuracy | Use/import detection >99% | Use patterns are well-defined |
| Coverage | Rust 2021 edition | Including async, const generics |

---

## 7. Related Tickets

| Ticket Key | Summary | Relationship |
|------------|---------|--------------|
| KSA-151 | [Tree-sitter] Rust Parser | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | Parent epic |
| KSA-145 | [Tree-sitter] Core Integration | Prerequisite |
| KSA-146 | [Tree-sitter] TypeScript/JavaScript Parser | Sibling |
| KSA-153 | [Graph] Data Model & Storage | Storage for relationships |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Trait | Rust's interface/typeclass mechanism |
| Impl block | Implementation block associating methods with a type |
| Lifetime | Rust's mechanism for tracking reference validity (`'a`) |
| Derive macro | Automatic trait implementation via `#[derive(...)]` |
| Crate | Rust's compilation unit (library or binary) |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| KSA-145 BRD (Core) | documents/KSA-145/BRD.md |
| tree-sitter-rust | https://github.com/tree-sitter/tree-sitter-rust |
