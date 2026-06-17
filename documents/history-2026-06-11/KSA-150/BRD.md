# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-150: [Tree-sitter] Go Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-150 |
| Title | [Tree-sitter] Go Parser |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-01 | BA Agent | Initial document — auto-generated from Jira ticket KSA-150 |

---

## 1. Introduction

### 1.1 Scope

Implement tree-sitter parser for Go that extracts:
- **Symbols**: functions, structs, interfaces, methods (with receiver), type aliases, constants, variables, packages
- **Relationships**: calls, imports, interface implementations (implicit)

This parser builds on the tree-sitter core infrastructure (KSA-145) and follows the same architecture as sibling parsers.

### 1.2 Out of Scope

- Tree-sitter core infrastructure (KSA-145 — prerequisite)
- Other language parsers (TypeScript → KSA-146, Java → KSA-149, etc.)
- Graph storage (KSA-153)
- Call graph query tools (KSA-154)
- Go module dependency resolution (go.mod analysis)
- CGo interop analysis

### 1.3 Preliminary Requirements

- Tree-sitter core integration complete (KSA-145)
- `tree-sitter-go` grammar package installed
- Base `TreeSitterParser` interface available from KSA-145

---

## 2. Business Requirements

### 2.1 High Level Process Map

Current regex extraction for Go captures only 3 patterns (func, struct, interface) with names only. The tree-sitter parser will extract:
- Full symbol metadata (params with types, return types, receiver type, exported status)
- All relationship types (calls, imports, implicit interface implementations)
- Package-level organization and exported/unexported analysis
- Method sets and receiver types

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a developer, I want all Go symbol types extracted with full metadata | MUST HAVE | KSA-150 |
| 2 | As a developer, I want function/method call relationships extracted | MUST HAVE | KSA-150 |
| 3 | As a developer, I want import relationships extracted for dependency analysis | MUST HAVE | KSA-150 |
| 4 | As a developer, I want methods associated with their receiver struct | MUST HAVE | KSA-150 |
| 5 | As a developer, I want interface implementation detection (implicit) | SHOULD HAVE | KSA-150 |
| 6 | As a developer, I want goroutine and channel patterns detected | COULD HAVE | KSA-150 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Indexer encounters a `.go` file

**Step 2:** Grammar registry (KSA-145) loads `tree-sitter-go`

**Step 3:** File is parsed into AST

**Step 4:** Go parser walks AST extracting symbols (functions, structs, interfaces, etc.)

**Step 5:** Go parser walks AST extracting relationships (calls, imports)

**Step 6:** Symbols stored in `symbols` table, relationships in `relationships` table (KSA-153)

---

#### STORY 1: Go Symbol Extraction

> As a developer, I want all Go symbol types extracted with full metadata.

**Symbol Types to Extract:**

| Symbol Type | AST Node Type | Metadata Extracted |
|-------------|---------------|-------------------|
| Function | `function_declaration` | name, params, return_types, exported, variadic |
| Method | `method_declaration` | name, receiver_type, params, return_types, pointer_receiver |
| Struct | `type_spec` (struct_type) | name, fields, embedded_types, exported |
| Interface | `type_spec` (interface_type) | name, methods, embedded_interfaces, exported |
| Type alias | `type_spec` | name, underlying_type, exported |
| Constant | `const_spec` | name, type, value, iota, exported |
| Variable | `var_spec` | name, type, exported |
| Package | `package_clause` | name |

**Acceptance Criteria:**

1. All 8 symbol types correctly extracted from Go files
2. Function parameters include names and types (e.g., `ctx context.Context, id int`)
3. Multiple return values captured (e.g., `(User, error)`)
4. Named return values captured (e.g., `(result int, err error)`)
5. Exported status determined by capitalization (Go convention)
6. Variadic parameters detected (e.g., `args ...string`)
7. Struct tags captured (e.g., `` `json:"name"` ``)

---

#### STORY 2: Function/Method Call Extraction

> As a developer, I want function/method call relationships extracted.

**Call Patterns to Detect:**

| Pattern | Example | Extracted As |
|---------|---------|-------------|
| Direct call | `foo()` | calls → `foo` |
| Package call | `fmt.Println()` | calls → `fmt.Println` |
| Method call | `s.Method()` | calls → `[type].Method` |
| Chained call | `resp.Body.Close()` | calls → `[type].Close` |
| Goroutine | `go handler()` | calls → `handler` (async) |
| Defer | `defer file.Close()` | calls → `[type].Close` (deferred) |
| Function literal | `func() { foo() }()` | calls → `foo` |

**Acceptance Criteria:**

1. Direct function calls detected with package qualifier
2. Method calls include receiver type when determinable
3. Goroutine calls marked with `async: true` metadata
4. Deferred calls marked with `deferred: true` metadata
5. Calls within function bodies attributed to containing function
6. At least 80% of call patterns detected

---

#### STORY 3: Import Extraction

> As a developer, I want import relationships extracted for dependency analysis.

**Import Patterns:**

| Pattern | Example | Extracted As |
|---------|---------|-------------|
| Single import | `import "fmt"` | imports → `fmt` |
| Grouped import | `import ("fmt"; "os")` | imports → `fmt`, imports → `os` |
| Aliased import | `import f "fmt"` | imports → `fmt` (alias: `f`) |
| Dot import | `import . "testing"` | imports → `testing` (dot) |
| Blank import | `import _ "driver"` | imports → `driver` (side-effect) |

**Acceptance Criteria:**

1. All import patterns correctly detected
2. Import aliases captured
3. Dot imports and blank imports marked with appropriate metadata
4. Package path preserved as-is (e.g., `github.com/user/repo/pkg`)

---

#### STORY 4: Method-Receiver Association

> As a developer, I want methods associated with their receiver struct.

**Acceptance Criteria:**

1. Method receiver type extracted (e.g., `func (s *Server) Start()` → receiver = `*Server`)
2. Pointer vs value receiver distinguished
3. Method creates `belongs_to` relationship to receiver struct
4. Method set for each struct determinable from relationships

---

#### STORY 5: Interface Implementation Detection

> As a developer, I want interface implementation detection (Go's implicit interfaces).

**Acceptance Criteria:**

1. For each struct, compare method set against known interfaces
2. If struct implements all methods of an interface → create `implements` relationship
3. This is best-effort (only works for interfaces defined in same indexed codebase)
4. Embedded interfaces resolved (interface embedding)

---

#### STORY 6: Goroutine and Channel Patterns

> As a developer, I want goroutine and channel patterns detected.

**Acceptance Criteria:**

1. `go` keyword usage detected, marking call as concurrent
2. Channel send/receive operations detected as relationships
3. `select` statement branches detected
4. This is informational metadata, not blocking for v1

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Tree-sitter core (KSA-145) | System | KSA-145 | Base parser infrastructure |
| tree-sitter-go | External | N/A | Go grammar package |
| Graph data model (KSA-153) | System | KSA-153 | Relationships table |
| KSA-146 (TypeScript parser) | Reference | KSA-146 | Architecture reference |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve extraction scope |
| Developer | Code Intelligence Team | Implement Go parser |
| QA | QA Team | Verify extraction accuracy |
| Users | AI Agent developers | Consume enriched Go data |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Implicit interface detection is computationally expensive | Medium | Medium | Limit to same-package interfaces first |
| Go generics (1.18+) not fully supported by grammar | Medium | Low | Check grammar version, contribute upstream |
| Large Go files with generated code | Low | Medium | Skip files matching `*_generated.go` pattern |

### 5.2 Assumptions

- tree-sitter-go grammar covers Go 1.21+ syntax (generics, range-over-func)
- Implicit interface detection is best-effort within indexed codebase
- External package types stored as string references
- Generated files can be excluded via configuration

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Parse + extract <15ms per file | For files under 1000 lines |
| Accuracy | Symbol extraction >95% | Compared to manual analysis |
| Accuracy | Call detection >80% | For direct and method calls |
| Accuracy | Import detection >99% | Import patterns are well-defined |
| Coverage | Go 1.21+ syntax | Including generics |

---

## 7. Related Tickets

| Ticket Key | Summary | Relationship |
|------------|---------|--------------|
| KSA-150 | [Tree-sitter] Go Parser | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | Parent epic |
| KSA-145 | [Tree-sitter] Core Integration | Prerequisite |
| KSA-146 | [Tree-sitter] TypeScript/JavaScript Parser | Sibling |
| KSA-153 | [Graph] Data Model & Storage | Storage for relationships |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Receiver | The type a method is attached to (`func (s *Server) Start()`) |
| Implicit interface | Go interfaces are satisfied implicitly (no `implements` keyword) |
| Goroutine | Lightweight concurrent execution (`go func()`) |
| Channel | Go's concurrency primitive for communication between goroutines |
| Exported | Capitalized identifiers are public in Go |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| KSA-145 BRD (Core) | documents/KSA-145/BRD.md |
| tree-sitter-go | https://github.com/tree-sitter/tree-sitter-go |
