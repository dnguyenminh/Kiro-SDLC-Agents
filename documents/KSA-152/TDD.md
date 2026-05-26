# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-152: [Tree-sitter] Per-language Grammar Configuration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-152 |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Related FSD | FSD-v1-KSA-152.docx |

---

## 1. Architecture Overview

The grammar configuration system sits between the tree-sitter parser engine and the symbol extraction layer, providing a data-driven mapping from AST nodes to code intelligence symbols.

```
┌─────────────────────────────────────────────────────┐
│ Indexer / Parser Engine                              │
├─────────────────────────────────────────────────────┤
│ Grammar Config System (NEW)                          │
│  ├── ConfigLoader (YAML → validated config)         │
│  ├── ConfigValidator (JSON Schema validation)       │
│  ├── LanguageRegistry (extension → config mapping)  │
│  ├── EntityMapper (AST node → symbol kind)          │
│  ├── RelationshipExtractor (config-driven)          │
│  └── ParserConfigResolver (global + per-lang)       │
├─────────────────────────────────────────────────────┤
│ Tree-sitter Runtime (KSA-145)                        │
│  ├── WASM Grammar Loader                            │
│  └── AST Parser                                     │
└─────────────────────────────────────────────────────┘
```

---

## 2. Module Design

### 2.1 File Structure

```
src/mcp_code_intel/
├── grammar/
│   ├── __init__.py
│   ├── config_loader.py       # Load + validate YAML configs
│   ├── config_validator.py    # JSON Schema validation
│   ├── language_registry.py   # Extension → language mapping
│   ├── entity_mapper.py       # AST node → symbol kind
│   ├── relationship_extractor.py  # Config-driven relationship extraction
│   └── parser_config.py       # ParserConfig resolution
├── config/
│   ├── grammars/
│   │   ├── python.yaml
│   │   ├── typescript.yaml
│   │   ├── kotlin.yaml
│   │   ├── java.yaml
│   │   ├── go.yaml
│   │   ├── rust.yaml
│   │   └── schema.json        # Config validation schema
│   ├── grammars/wasm/
│   │   ├── tree-sitter-python.wasm
│   │   ├── tree-sitter-typescript.wasm
│   │   └── ...
│   └── parser-global.yaml     # Global parser config
```

### 2.2 Class Design

#### ConfigLoader

```python
class ConfigLoader:
    """Load and validate grammar configuration files."""
    
    def __init__(self, grammar_dir: str = "config/grammars"):
        self.grammar_dir = grammar_dir
        self.schema = self._load_schema()
    
    def load_all(self) -> dict[str, GrammarConfig]:
        """Load all grammar configs from directory."""
        
    def load_language(self, language: str) -> GrammarConfig:
        """Load config for specific language."""
        
    def validate(self, config: dict) -> list[ValidationError]:
        """Validate config against schema."""

@dataclass
class GrammarConfig:
    language: str
    display_name: str
    extensions: list[str]
    grammar_wasm: str
    entities: dict[str, EntityConfig]
    relationships: dict[str, RelationshipConfig]
    scoping: ScopingConfig
    parser_config: ParserConfig
```

#### LanguageRegistry

```python
class LanguageRegistry:
    """Maps file extensions to language configurations."""
    
    def __init__(self):
        self._ext_map: dict[str, GrammarConfig] = {}
        self._languages: dict[str, GrammarConfig] = {}
    
    def register(self, config: GrammarConfig) -> None:
        """Register a language config."""
        
    def get_by_extension(self, ext: str) -> Optional[GrammarConfig]:
        """Lookup language by file extension."""
        
    def get_by_name(self, name: str) -> Optional[GrammarConfig]:
        """Lookup language by name."""
        
    def list_languages(self) -> list[LanguageInfo]:
        """List all registered languages."""
```

#### EntityMapper

```python
class EntityMapper:
    """Map tree-sitter AST nodes to code intelligence symbols."""
    
    def __init__(self, config: GrammarConfig):
        self.config = config
        self._compiled_patterns = self._compile(config.entities)
    
    def map_node(self, node: TreeSitterNode, parent: Optional[TreeSitterNode]) -> Optional[Symbol]:
        """Map an AST node to a symbol if it matches entity config."""
        
    def extract_name(self, node: TreeSitterNode, entity_config: EntityConfig) -> str:
        """Extract symbol name from AST node using config field mapping."""
        
    def extract_body(self, node: TreeSitterNode, entity_config: EntityConfig) -> Optional[str]:
        """Extract body text if body_field is configured."""
```

#### ParserConfigResolver

```python
@dataclass
class ParserConfig:
    include_private: bool = False
    include_tests: bool = False
    parse_docs: bool = True
    max_file_size: int = 1_048_576  # 1MB
    max_function_size: int = 10_000
    parallel_workers: int = 0  # 0 = auto
    timeout_per_file: int = 5000  # ms

class ParserConfigResolver:
    """Resolve effective ParserConfig (global + per-language override)."""
    
    def __init__(self, global_config: ParserConfig):
        self.global_config = global_config
    
    def resolve(self, language_config: Optional[ParserConfig]) -> ParserConfig:
        """Merge global with per-language overrides."""
```

---

## 3. Configuration Schema

### 3.1 JSON Schema for Validation

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["schema_version", "language", "extensions", "grammar_wasm", "entities"],
  "properties": {
    "schema_version": {"type": "string", "pattern": "^\\d+\\.\\d+$"},
    "language": {"type": "string", "pattern": "^[a-z][a-z0-9_-]*$"},
    "display_name": {"type": "string"},
    "extensions": {"type": "array", "items": {"type": "string", "pattern": "^\\."}, "minItems": 1},
    "grammar_wasm": {"type": "string", "pattern": "\\.wasm$"},
    "parser_config": {"$ref": "#/definitions/parser_config"},
    "entities": {"type": "object", "additionalProperties": {"$ref": "#/definitions/entity_config"}},
    "relationships": {"type": "object", "additionalProperties": {"$ref": "#/definitions/relationship_config"}},
    "scoping": {"$ref": "#/definitions/scoping_config"}
  }
}
```

---

## 4. Performance Design

| Operation | Target | Approach |
|-----------|--------|----------|
| Config load (all languages) | < 50ms | YAML parse + cache compiled patterns |
| Extension lookup | O(1) | HashMap |
| Entity mapping (per node) | < 0.1ms | Pre-compiled pattern matching |
| Hot-reload | < 100ms | Atomic swap of registry |
| Schema validation | < 10ms | Cached JSON Schema validator |

---

## 5. Error Handling

| Error | Recovery |
|-------|----------|
| Invalid YAML syntax | Skip language, log error with line number |
| Schema validation fail | Skip language, log specific field errors |
| Missing WASM binary | Skip language, log expected path |
| Duplicate extension | Last-loaded wins, log warning |
| Unknown entity kind | Ignore silently (forward compat) |
| Config hot-reload fail | Keep previous config, log error |

---

## 6. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | ConfigLoader + YAML parsing | grammar/config_loader.py | 1d |
| 2 | ConfigValidator + JSON Schema | grammar/config_validator.py | 0.5d |
| 3 | LanguageRegistry | grammar/language_registry.py | 0.5d |
| 4 | EntityMapper | grammar/entity_mapper.py | 1d |
| 5 | RelationshipExtractor | grammar/relationship_extractor.py | 1d |
| 6 | ParserConfigResolver | grammar/parser_config.py | 0.5d |
| 7 | Python grammar config | config/grammars/python.yaml | 0.5d |
| 8 | TypeScript grammar config | config/grammars/typescript.yaml | 0.5d |
| 9 | Kotlin/Java/Go/Rust configs | config/grammars/*.yaml | 1d |
| 10 | Integration tests | tests/grammar/ | 1d |

**Total estimate:** ~8 days (0.5 weeks with buffer matches Jira estimate)

---

## 7. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
