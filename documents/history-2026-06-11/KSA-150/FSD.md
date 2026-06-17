# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-150: [Tree-sitter] Go Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-150 |
| Title | [Tree-sitter] Go Parser |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-150.docx |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the Go language parser using tree-sitter. It defines AST node mappings, relationship extraction for Go-specific patterns (receivers, implicit interfaces, goroutines), and package-level organization.

### 1.2 Scope

- Go symbol extraction (functions, methods, structs, interfaces, types, constants)
- Call relationship extraction (function calls, method calls, goroutines, defers)
- Import relationship extraction
- Method-receiver association
- Interface implementation detection (implicit)

---

## 2. System Overview

### 2.1 Parser Architecture

```
GoParser implements ILanguageParser
    │
    ├── SymbolExtractor
    │     ├── FunctionExtractor (function_declaration, method_declaration)
    │     ├── TypeExtractor (type_spec: struct, interface, alias)
    │     ├── ConstVarExtractor (const_spec, var_spec)
    │     └── PackageExtractor (package_clause)
    │
    └── RelationshipExtractor
          ├── CallExtractor (call_expression)
          ├── ImportExtractor (import_spec)
          ├── ReceiverExtractor (method receiver → struct)
          └── InterfaceImplDetector (method set comparison)
```

### 2.2 File Extensions

| Extension | Grammar | Notes |
|-----------|---------|-------|
| `.go` | `tree-sitter-go` | All Go source files |

---

## 3. Functional Requirements

### 3.1 Feature: Symbol Extraction

#### 3.1.1 AST Node Type Mapping

| Go Construct | AST Node Type | Extracted Kind | Example |
|-------------|---------------|----------------|---------|
| `func foo()` | `function_declaration` | `function` | `func ParseConfig(path string) (*Config, error)` |
| `func (s *S) M()` | `method_declaration` | `method` | `func (s *Server) Start(ctx context.Context) error` |
| `type S struct` | `type_spec` + `struct_type` | `struct` | `type User struct { ID int; Name string }` |
| `type I interface` | `type_spec` + `interface_type` | `interface` | `type Reader interface { Read(p []byte) (int, error) }` |
| `type T = U` | `type_spec` + `type_identifier` | `type_alias` | `type Duration = time.Duration` |
| `const X` | `const_spec` | `constant` | `const MaxRetries = 3` |
| `var X` | `var_spec` | `variable` | `var ErrNotFound = errors.New("not found")` |
| `package main` | `package_clause` | `package` | `package handlers` |

#### 3.1.2 Use Case: UC-01 — Extract Function

**Main Flow:**
1. Find `function_declaration` node
2. Extract `name` from `identifier` child
3. Extract `parameters` from `parameter_list` child
4. For each `parameter_declaration`: extract names (may be multiple) + type
5. Extract `result` (return types) — may be single type or `parameter_list`
6. Detect variadic (`...` prefix on last param type)
7. Determine exported status (first letter uppercase)

**Output:**
```json
{
  "name": "ParseConfig",
  "kind": "function",
  "parameters": "(path string, opts ...Option)",
  "return_type": "(*Config, error)",
  "exported": true,
  "variadic": true,
  "start_line": 10,
  "end_line": 35
}
```

#### 3.1.3 Use Case: UC-02 — Extract Method with Receiver

**Main Flow:**
1. Find `method_declaration` node
2. Extract receiver from `parameter_list` (first param list before name)
3. Determine receiver type and pointer/value
4. Extract method name, params, return types (same as function)
5. Create `belongs_to` relationship: method → receiver struct

**Output:**
```json
{
  "name": "Start",
  "kind": "method",
  "receiver": "*Server",
  "receiver_type": "Server",
  "pointer_receiver": true,
  "parameters": "(ctx context.Context)",
  "return_type": "error",
  "exported": true
}
```

#### 3.1.4 Use Case: UC-03 — Extract Struct

**Main Flow:**
1. Find `type_spec` with `struct_type` child
2. Extract struct name
3. Extract fields from `field_declaration_list`
4. For each field: name(s), type, tag (struct tag string)
5. Detect embedded types (fields with no name, just type)

---

### 3.2 Feature: Relationship Extraction

#### 3.2.1 Call Extraction

**AST Pattern:** `call_expression` node

| Pattern | AST Structure | Extraction |
|---------|--------------|------------|
| `foo()` | `call_expression` → `identifier` | target = "foo" |
| `pkg.Func()` | `call_expression` → `selector_expression` | target = "pkg.Func" |
| `s.Method()` | `call_expression` → `selector_expression` | target = "[type].Method" |
| `go handler()` | `go_statement` → `call_expression` | target = "handler", async=true |
| `defer f.Close()` | `defer_statement` → `call_expression` | target = "[type].Close", deferred=true |

#### 3.2.2 Import Extraction

**AST Pattern:** `import_spec` within `import_declaration`

**Logic:**
1. Extract path from `interpreted_string_literal`
2. Check for alias (`name` child before path)
3. Detect dot import (name = `.`)
4. Detect blank import (name = `_`)

#### 3.2.3 Interface Implementation Detection

**Algorithm (post-parse phase):**
```
for each struct S in parsed symbols:
  methodSet = getMethodsOf(S)  // from belongs_to relationships
  for each interface I in parsed symbols:
    requiredMethods = getMethodsOf(I)
    if methodSet contains all requiredMethods (by name + signature):
      create relationship: S implements I
```

**Note:** This is best-effort, limited to interfaces in the same indexed codebase.

---

## 4. API Contracts

### 4.1 Parser Interface

```typescript
interface GoParseResult extends ParseResult {
  symbols: GoSymbol[];
  relationships: Relationship[];
}

interface GoSymbol extends Symbol {
  exported: boolean;           // Capitalized = exported
  receiver?: string;           // For methods: "*Server" or "Server"
  pointer_receiver?: boolean;  // true if *T receiver
  variadic?: boolean;          // true if last param is ...T
  struct_tags?: Record<string, string>;  // For struct fields
  embedded_types?: string[];   // For structs with embedded types
}
```

---

## 5. Non-Functional Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Parse speed | <15ms per file (<1000 lines) | Benchmark test |
| Accuracy (symbols) | >95% | Test against reference corpus |
| Accuracy (calls) | >80% | Test against reference corpus |
| Interface impl detection | >70% | Limited to same-codebase interfaces |

---

## 6. Error Handling

| Error | Handling |
|-------|----------|
| Syntax error in Go file | tree-sitter partial AST, extract available |
| Generated files (*_generated.go) | Skip by default (configurable) |
| Test files (*_test.go) | Parse normally, mark as test file |
| Build tags (//go:build) | Ignore, parse all files |

---

## 7. Test Strategy

| Test Type | Coverage |
|-----------|----------|
| Unit tests | Each extractor (function, method, struct, interface, import, call) |
| Integration tests | Full file parse → verify symbols + relationships |
| Receiver tests | Pointer vs value receiver, multiple methods per struct |
| Interface impl tests | Verify implicit implementation detection |
| Performance tests | Benchmark 100 Go files |
