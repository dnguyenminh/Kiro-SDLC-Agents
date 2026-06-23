# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-152: [Tree-sitter] Per-language Grammar Configuration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-152 |
| Title | [Tree-sitter] Per-language Grammar Configuration |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-07 | BA Agent | Initial document — auto-generated from Jira ticket KSA-152 |

---

## 1. Introduction

### 1.1 Scope

This ticket creates a configurable grammar system for tree-sitter parsing. Instead of hardcoding language-specific extraction logic, the system uses configuration files that define:
- Entity mapping tables per language (what AST nodes map to what symbol kinds)
- Parser configuration (include_private, include_tests, parse_docs, max_file_size)
- Support for adding new languages via config without code changes
- Parallel processing configuration

This enables the tree-sitter infrastructure (KSA-145) to be extended to new languages by simply adding a grammar config file.

### 1.2 Out of Scope

- Writing new tree-sitter grammar WASM binaries (use existing community grammars)
- Language-specific semantic analysis (that's per-language ticket scope)
- IDE integration / LSP protocol
- Grammar auto-detection from file content (use file extension only)

### 1.3 Preliminary Requirements

- KSA-145: Tree-sitter Core Integration (base parsing infrastructure)
- KSA-146 through KSA-151: Per-language parser implementations (provide patterns to generalize)
- Tree-sitter WASM binaries for target languages

---

## 2. Business Requirements

### 2.1 High Level Process Map

Currently, each language parser (KSA-146 to KSA-151) has hardcoded extraction logic. This ticket generalizes that into a configuration-driven system where:
1. A grammar config file defines AST node to symbol kind mappings
2. The parser engine reads config and applies it generically
3. New languages can be added by creating a config file + providing WASM grammar

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a developer, I want to add new language support via config file so that no code changes are needed | MUST HAVE | KSA-152 |
| 2 | As a developer, I want per-language entity mapping tables so that extraction is accurate per language | MUST HAVE | KSA-152 |
| 3 | As a developer, I want ParserConfig options (include_private, include_tests, parse_docs) so that I can control what gets indexed | MUST HAVE | KSA-152 |
| 4 | As a developer, I want max_file_size configuration so that huge generated files are skipped | SHOULD HAVE | KSA-152 |
| 5 | As a developer, I want parallel processing config so that indexing uses available CPU cores | SHOULD HAVE | KSA-152 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** System loads grammar config files from `config/grammars/` directory

**Step 2:** For each file to parse, determine language from file extension

**Step 3:** Load corresponding grammar config (entity mappings, parser options)

**Step 4:** Apply ParserConfig filters (skip private, skip tests, respect max_file_size)

**Step 5:** Parse file with tree-sitter using language WASM grammar

**Step 6:** Map AST nodes to symbols using entity mapping table from config

**Step 7:** Extract relationships based on config-defined patterns

---

#### STORY 1: Config-driven Language Support

> As a developer, I want to add new language support via config file so that no code changes are needed.

**Requirement Details:**

Grammar config file format (YAML):

```yaml
language: python
extensions: [".py", ".pyi"]
grammar_wasm: "tree-sitter-python.wasm"

entities:
  function:
    node_types: ["function_definition"]
    name_field: "name"
    body_field: "body"
    decorators_field: "decorator_list"
  class:
    node_types: ["class_definition"]
    name_field: "name"
    body_field: "body"
    bases_field: "argument_list"
  method:
    node_types: ["function_definition"]
    parent_type: "class_definition"
    name_field: "name"

relationships:
  calls:
    node_types: ["call"]
    target_field: "function"
  imports:
    node_types: ["import_statement", "import_from_statement"]
    module_field: "module_name"
  inheritance:
    source: "class"
    target_field: "bases_field"

scoping:
  private_prefix: "_"
  test_patterns: ["test_*", "*_test.py", "tests/"]
```

**Acceptance Criteria:**

1. New language added by creating config file + providing WASM grammar
2. No code changes required for new language support
3. Config validates on load (schema validation)
4. Invalid config produces clear error messages
5. Hot-reload: config changes picked up without server restart

---

#### STORY 2: Entity Mapping Tables

> As a developer, I want per-language entity mapping tables so that extraction is accurate per language.

**Requirement Details:**

Each language config defines mappings from tree-sitter AST node types to Code Intelligence symbol kinds:

| Symbol Kind | Python Nodes | TypeScript Nodes | Kotlin Nodes |
|-------------|-------------|-----------------|--------------|
| function | function_definition | function_declaration, arrow_function | function_declaration |
| class | class_definition | class_declaration | class_declaration |
| interface | N/A | interface_declaration | interface_declaration |
| method | function_definition (in class) | method_definition | function_declaration (in class) |
| enum | N/A | enum_declaration | enum_class_body |
| field | assignment (in class) | property_declaration | property_declaration |

**Acceptance Criteria:**

1. Entity mapping covers all 6 supported languages
2. Mapping handles language-specific nuances (e.g., Python methods vs functions)
3. Unknown node types gracefully ignored (not crash)
4. Mapping extensible for new entity kinds

---

#### STORY 3: ParserConfig Options

> As a developer, I want ParserConfig options so that I can control what gets indexed.

**Requirement Details:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| include_private | boolean | false | Include private/internal symbols |
| include_tests | boolean | false | Include test files and test functions |
| parse_docs | boolean | true | Extract docstrings/JSDoc/KDoc |
| max_file_size | integer | 1048576 (1MB) | Skip files larger than this |
| max_function_size | integer | 10000 | Skip functions with more lines |
| parallel_workers | integer | CPU cores | Number of parallel parse workers |
| timeout_per_file | integer | 5000ms | Max parse time per file |

**Acceptance Criteria:**

1. All ParserConfig options respected during parsing
2. Options configurable globally and per-language override
3. Default values produce reasonable results
4. Options documented with examples

---

#### STORY 4: Max File Size Configuration

> As a developer, I want max_file_size configuration so that huge generated files are skipped.

**Acceptance Criteria:**

1. Files exceeding max_file_size are skipped with warning log
2. Default 1MB catches most generated files
3. Per-language override possible (e.g., allow larger SQL files)
4. Skipped files reported in indexing summary

---

#### STORY 5: Parallel Processing

> As a developer, I want parallel processing config so that indexing uses available CPU cores.

**Acceptance Criteria:**

1. Parallel workers configurable (default: CPU core count)
2. File parsing distributed across workers
3. Thread-safe graph updates (no race conditions)
4. Performance scales linearly up to 4 cores

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Tree-sitter Core | System | KSA-145 | Base parsing infrastructure |
| Python Parser | Reference | KSA-146 | Patterns to generalize |
| TypeScript Parser | Reference | KSA-147 | Patterns to generalize |
| Kotlin Parser | Reference | KSA-148 | Patterns to generalize |
| Java Parser | Reference | KSA-149 | Patterns to generalize |
| Go Parser | Reference | KSA-150 | Patterns to generalize |
| Rust Parser | Reference | KSA-151 | Patterns to generalize |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve requirements |
| Developer | Code Intelligence Team | Implement config system |
| Users | Language contributors | Add new language configs |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Config too complex for contributors | Medium | Medium | Provide templates, validation, documentation |
| Performance overhead from config interpretation | Low | Low | Cache parsed configs, compile patterns |
| AST node types change between grammar versions | Medium | Low | Version pin grammars, migration guide |

### 5.2 Assumptions

- Tree-sitter AST node types are stable across minor versions
- YAML/JSON config is sufficient (no need for DSL)
- 6 initial languages cover 90%+ of user codebases
- Community tree-sitter grammars are high quality

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Config load < 10ms | Per language |
| Extensibility | New language via config only | No code changes |
| Validation | Schema validation on load | Clear error messages |
| Documentation | Config reference docs | Per-language examples |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-152 | [Tree-sitter] Per-language Grammar Configuration | To Do | Task | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | To Do | Epic | Parent epic |
| KSA-145 | [Tree-sitter] Core Integration | To Do | Task | Prerequisite |
| KSA-146 | [Tree-sitter] Python Parser | To Do | Task | Reference implementation |
| KSA-147 | [Tree-sitter] TypeScript Parser | To Do | Task | Reference implementation |
| KSA-148 | [Tree-sitter] Kotlin Parser | To Do | Task | Reference implementation |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Grammar Config | YAML file defining AST-to-symbol mappings for a language |
| Entity Mapping | Table mapping tree-sitter node types to symbol kinds |
| ParserConfig | Runtime options controlling parsing behavior |
| WASM Grammar | WebAssembly-compiled tree-sitter grammar binary |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| KSA-145 BRD (Tree-sitter Core) | documents/KSA-145/BRD.md |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
