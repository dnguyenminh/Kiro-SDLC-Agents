# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-152: [Tree-sitter] Per-language Grammar Configuration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-152 |
| Title | [Tree-sitter] Per-language Grammar Configuration |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-152.docx |

---

## 1. Use Cases

### UC-152-01: Load Grammar Configuration

**Actor:** System (Parser Engine)

**Main Flow:**
1. On startup, scan `config/grammars/` directory for YAML files
2. For each YAML file: validate against grammar config schema
3. Register language with extension mappings
4. Load corresponding WASM grammar binary
5. Cache compiled config for runtime use

**Alternative Flows:**
- 2a. Invalid YAML → log error with line number, skip language
- 4a. WASM binary not found → log error, skip language
- 5a. Duplicate extension mapping → last-loaded wins, log warning

### UC-152-02: Parse File Using Grammar Config

**Actor:** System (Indexer)

**Main Flow:**
1. Determine file language from extension (using registered mappings)
2. Load grammar config for that language
3. Apply ParserConfig filters (check file size, test file patterns)
4. Parse file with tree-sitter using WASM grammar
5. Walk AST, match node types against entity mapping table
6. For each matched node: extract symbol (name, kind, location, body)
7. Extract relationships using relationship config patterns
8. Return extracted symbols and relationships

**Alternative Flows:**
- 1a. Extension not registered → skip file (unknown language)
- 3a. File exceeds max_file_size → skip, log warning
- 3b. File matches test_patterns AND include_tests=false → skip
- 5a. AST node type not in mapping → ignore node

### UC-152-03: Add New Language via Config

**Actor:** Developer / Contributor

**Main Flow:**
1. Create new YAML file in `config/grammars/{language}.yaml`
2. Define extensions, entity mappings, relationship patterns
3. Place WASM grammar binary in `config/grammars/wasm/`
4. Restart server (or trigger hot-reload)
5. System validates config and registers new language
6. New language files are now indexed

**Alternative Flows:**
- 5a. Validation fails → error message with specific field/line

### UC-152-04: Override ParserConfig Per-Language

**Actor:** Developer

**Main Flow:**
1. In grammar config YAML, add `parser_config` section
2. Override global defaults (e.g., include_private: true for Go)
3. On next parse, per-language config takes precedence over global

---

## 2. Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-152-01 | Extension mapping must be unique across all configs | Prevent ambiguous language detection |
| BR-152-02 | Per-language ParserConfig overrides global config | Language-specific needs differ |
| BR-152-03 | Unknown AST node types are silently ignored | Forward compatibility with grammar updates |
| BR-152-04 | Config schema version must match engine version | Prevent incompatible configs |
| BR-152-05 | WASM grammar binary must be present for language to activate | No fallback to regex |
| BR-152-06 | max_file_size default = 1MB, overridable per language | Prevent OOM on generated files |
| BR-152-07 | parallel_workers default = CPU core count | Maximize indexing throughput |
| BR-152-08 | Config hot-reload only adds/updates, never removes active languages | Prevent mid-session breakage |

---

## 3. Data Specifications

### 3.1 Grammar Config Schema (YAML)

```yaml
# config/grammars/python.yaml
schema_version: "1.0"
language: "python"
display_name: "Python"
extensions: [".py", ".pyi", ".pyw"]
grammar_wasm: "tree-sitter-python.wasm"

parser_config:
  include_private: false
  include_tests: false
  parse_docs: true
  max_file_size: 1048576
  timeout_per_file: 5000

entities:
  function:
    node_types: ["function_definition"]
    name_field: "name"
    body_field: "body"
    params_field: "parameters"
    return_type_field: "return_type"
    modifiers:
      async: { parent_type: "async" }
      decorator: { field: "decorator_list" }
  
  class:
    node_types: ["class_definition"]
    name_field: "name"
    body_field: "body"
    bases_field: "argument_list"
  
  method:
    node_types: ["function_definition"]
    parent_types: ["class_definition"]
    name_field: "name"
    body_field: "body"

relationships:
  calls:
    node_types: ["call"]
    target_field: "function"
    resolve_strategy: "name_lookup"
  
  imports:
    node_types: ["import_statement", "import_from_statement"]
    module_field: "module_name"
    names_field: "name"
  
  inheritance:
    source_kind: "class"
    target_field: "bases_field"

scoping:
  private_patterns: ["^_[^_]", "^__[^_]"]
  test_file_patterns: ["test_*.py", "*_test.py", "tests/**"]
  test_function_patterns: ["test_*"]
```

### 3.2 Global Config

```yaml
# config/parser-global.yaml
schema_version: "1.0"

defaults:
  include_private: false
  include_tests: false
  parse_docs: true
  max_file_size: 1048576
  max_function_size: 10000
  parallel_workers: 0  # 0 = auto (CPU cores)
  timeout_per_file: 5000

grammar_dir: "config/grammars"
wasm_dir: "config/grammars/wasm"
```

### 3.3 Entity Kind Enum

| Kind | Description | Languages |
|------|-------------|-----------|
| function | Top-level function | All |
| class | Class definition | All |
| interface | Interface definition | TS, Kotlin, Java, Go, Rust |
| method | Class method | All |
| field | Class field/property | All |
| enum | Enumeration | TS, Kotlin, Java, Rust |
| module | Module/namespace | Python, Rust, TS |
| type_alias | Type alias | TS, Kotlin, Rust, Go |
| constant | Top-level constant | All |

---

## 4. API Specifications

### 4.1 MCP Tool: `list_languages`

**Input:** None

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| languages[].name | string | Language identifier |
| languages[].display_name | string | Human-readable name |
| languages[].extensions | string[] | File extensions |
| languages[].entity_kinds | string[] | Supported entity kinds |
| languages[].config_version | string | Config schema version |

### 4.2 MCP Tool: `get_parser_config`

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| language | string | No | Specific language (or all) |

**Output:** Current effective ParserConfig (global + per-language overrides)

---

## 5. Processing Logic

### 5.1 Config Loading Sequence

| Step | Action | Failure Mode |
|------|--------|-------------|
| 1 | Read global config | Use hardcoded defaults |
| 2 | Scan grammar_dir for YAML files | Empty = no languages |
| 3 | Validate each YAML against schema | Skip invalid, log error |
| 4 | Check WASM binary exists | Skip language, log error |
| 5 | Register extension mappings | Warn on duplicates |
| 6 | Compile regex patterns | Fail = skip language |
| 7 | Report loaded languages | Always succeeds |

### 5.2 File → Language Resolution

```
1. Get file extension (e.g., ".py")
2. Lookup in extension_map → language config
3. If not found: check secondary patterns (e.g., "Makefile" → makefile)
4. If still not found: return None (skip file)
```

---

## 6. Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Config Load | All configs loaded | < 50ms total |
| Parse Speed | Per-file parsing | < 100ms for 1000-line file |
| Extensibility | New language | Config file only, no code |
| Validation | Config errors | Clear message with line number |
| Hot-reload | Config update | < 100ms, no downtime |

---

## 7. Error Handling

| Scenario | Severity | Behavior |
|----------|----------|----------|
| Invalid YAML syntax | Error | Skip language, log with line number |
| Missing WASM binary | Error | Skip language, log path |
| Duplicate extension | Warning | Last-loaded wins, log conflict |
| Unknown entity kind | Warning | Ignore, log for debugging |
| Config schema mismatch | Error | Skip language, suggest upgrade |

---

## 8. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Config Load Sequence | [sequence-config-load.png](diagrams/sequence-config-load.png) | [sequence-config-load.drawio](diagrams/sequence-config-load.drawio) |
| 3 | Parser State | [state-parser.png](diagrams/state-parser.png) | [state-parser.drawio](diagrams/state-parser.drawio) |
