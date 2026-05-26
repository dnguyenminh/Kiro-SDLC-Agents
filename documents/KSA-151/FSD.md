# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-151: [Tree-sitter] Rust Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-151 |
| Title | [Tree-sitter] Rust Parser |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-151.docx |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the Rust language parser using tree-sitter. It covers symbol extraction for Rust's unique constructs (traits, impl blocks, modules, lifetimes), relationship extraction (trait implementations, use paths), and macro invocation detection.

### 1.2 Scope

- Rust symbol extraction (functions, structs, enums, traits, impl blocks, modules, macros)
- Call relationship extraction (function calls, method calls, macro invocations)
- Use (import) relationship extraction
- Trait implementation relationship extraction
- Impl block → type association
- Module hierarchy detection

---

## 2. System Overview

### 2.1 Parser Architecture

```
RustParser implements ILanguageParser
    │
    ├── SymbolExtractor
    │     ├── FunctionExtractor (function_item)
    │     ├── TypeExtractor (struct_item, enum_item, type_item)
    │     ├── TraitExtractor (trait_item)
    │     ├── ImplExtractor (impl_item)
    │     ├── ModuleExtractor (mod_item)
    │     └── MacroExtractor (macro_definition, macro_rules!)
    │
    └── RelationshipExtractor
          ├── CallExtractor (call_expression, macro_invocation)
          ├── UseExtractor (use_declaration)
          ├── ImplRelationExtractor (impl Trait for Type)
          └── ModuleHierarchyExtractor (mod nesting)
```

### 2.2 File Extensions

| Extension | Grammar | Notes |
|-----------|---------|-------|
| `.rs` | `tree-sitter-rust` | All Rust source files |

---

## 3. Functional Requirements

### 3.1 Feature: Symbol Extraction

#### 3.1.1 AST Node Type Mapping

| Rust Construct | AST Node Type | Extracted Kind | Example |
|---------------|---------------|----------------|---------|
| `fn foo()` | `function_item` | `function` | `pub async fn process(data: &[u8]) -> Result<Output>` |
| `struct Foo` | `struct_item` | `struct` | `#[derive(Debug)] pub struct Config { port: u16 }` |
| `enum Foo` | `enum_item` | `enum` | `pub enum Error { NotFound, Timeout(Duration) }` |
| `trait Foo` | `trait_item` | `trait` | `pub trait Handler: Send + Sync` |
| `impl Foo` | `impl_item` | `impl` | `impl Display for Config` |
| `mod foo` | `mod_item` | `module` | `pub mod handlers;` |
| `type Foo = Bar` | `type_item` | `type_alias` | `type Result<T> = std::result::Result<T, Error>` |
| `const X` | `const_item` | `constant` | `pub const MAX_SIZE: usize = 1024` |
| `static X` | `static_item` | `static` | `static COUNTER: AtomicU64 = AtomicU64::new(0)` |
| `macro_rules! foo` | `macro_definition` | `macro` | `macro_rules! vec { ... }` |

#### 3.1.2 Use Case: UC-01 — Extract Function

**Main Flow:**
1. Find `function_item` node
2. Extract `name` from `identifier`
3. Extract `visibility_modifier` (pub, pub(crate), pub(super))
4. Extract `function_modifiers` (async, unsafe, const, extern)
5. Extract `type_parameters` (generics + lifetime params)
6. Extract `parameters` from `parameters` node
7. For each param: pattern + type + mutability
8. Extract `return_type` from `->` type
9. Extract `where_clause` if present

#### 3.1.3 Use Case: UC-02 — Extract Impl Block

**Main Flow:**
1. Find `impl_item` node
2. Check if trait impl: has `trait` type before `for` keyword
3. Extract target type (after `for` or standalone)
4. Extract type parameters and where clause
5. Extract all methods within impl block
6. Create relationships:
   - If trait impl: target_type `implements` trait
   - All methods: `belongs_to` target_type

#### 3.1.4 Use Case: UC-03 — Extract Trait

**Main Flow:**
1. Find `trait_item` node
2. Extract name, visibility, type parameters
3. Extract supertraits (after `:` in trait declaration)
4. Extract method signatures (trait methods may have no body)
5. Extract associated types and constants

---

### 3.2 Feature: Relationship Extraction

#### 3.2.1 Call Extraction

| Pattern | AST Node | Extraction |
|---------|----------|------------|
| `foo()` | `call_expression` → `identifier` | target = "foo" |
| `s.method()` | `call_expression` → `field_expression` | target = "[type].method" |
| `Type::assoc()` | `call_expression` → `scoped_identifier` | target = "Type::assoc" |
| `println!()` | `macro_invocation` | target = "println" (macro=true) |
| `future.await` | `await_expression` | target = "[type].poll" (async) |

#### 3.2.2 Use (Import) Extraction

**AST Pattern:** `use_declaration` node

**Handling grouped uses:**
```rust
use std::{io::{self, Read, Write}, fs};
```
→ Expand to: `std::io`, `std::io::Read`, `std::io::Write`, `std::fs`

**Logic:**
1. Walk `use_declaration` tree recursively
2. Build full path by concatenating path segments
3. Handle `self` keyword (imports the module itself)
4. Handle `*` (glob import)
5. Handle `as` alias

#### 3.2.3 Trait Implementation Extraction

**From impl blocks:**
- `impl Display for Config` → Config `implements` Display
- `#[derive(Clone, Debug)]` → Config `implements` Clone, Debug

**From trait declarations:**
- `trait Handler: Send + Sync` → Handler `inherits` Send, Sync (supertraits)

---

## 4. API Contracts

### 4.1 Parser Interface

```typescript
interface RustSymbol extends Symbol {
  visibility: "pub" | "pub_crate" | "pub_super" | "private";
  is_async: boolean;
  is_unsafe: boolean;
  is_const: boolean;
  lifetimes?: string[];        // ['a, 'b]
  where_clause?: string;       // where T: Display + Clone
  derive_macros?: string[];    // ["Debug", "Clone", "Serialize"]
  impl_target?: string;        // For methods: which type this impl is for
  impl_trait?: string;         // For trait impl methods: which trait
}
```

---

## 5. Non-Functional Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Parse speed | <15ms per file (<1000 lines) | Benchmark test |
| Accuracy (symbols) | >95% | Test against reference corpus |
| Accuracy (calls) | >80% | Including macro invocations |
| Use path expansion | >99% | Grouped uses correctly expanded |

---

## 6. Error Handling

| Error | Handling |
|-------|----------|
| Macro-heavy code | Extract invocation sites, skip expansion |
| Procedural macro attributes | Capture as annotations, don't expand |
| Complex lifetime annotations | Store as string, don't validate |
| Conditional compilation (#[cfg(...)]) | Parse all branches |

---

## 7. Test Strategy

| Test Type | Coverage |
|-----------|----------|
| Unit tests | Each extractor (fn, struct, enum, trait, impl, mod, use) |
| Integration tests | Full file parse → verify symbols + relationships |
| Impl block tests | Inherent impl, trait impl, generic impl |
| Use path tests | Simple, grouped, nested, aliased, glob |
| Macro tests | macro_rules!, proc macro attributes, derive |
