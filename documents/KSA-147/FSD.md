# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-147: [Tree-sitter] Kotlin Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-147 |
| Title | [Tree-sitter] Kotlin Parser |
| Author | BA + TA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-147.docx |

---

## 1. Overview

This document specifies the functional behavior of the Kotlin language parser module that integrates with the tree-sitter core (KSA-145) to provide rich symbol extraction and relationship mapping for Kotlin source files.

---

## 2. Use Cases

### UC-1: Parse Kotlin File for Symbols

| Field | Value |
|-------|-------|
| Actor | TreeSitterIndexer (system) |
| Trigger | File change detected (.kt extension) |
| Precondition | tree-sitter-kotlin grammar loaded in GrammarRegistry |

**Main Flow:**
1. TreeSitterIndexer receives file path with `.kt` extension
2. GrammarRegistry returns KotlinParser instance
3. KotlinParser reads source, generates AST via tree-sitter
4. Parser walks AST extracting symbols (classes, functions, properties, etc.)
5. Parser walks AST extracting relationships (calls, imports, inheritance)
6. Parser calculates cyclomatic complexity for each function
7. Returns ParseResult with symbols[], relationships[], errors[]

**Alternative Flow — Grammar Not Available:**
1. GrammarRegistry cannot load tree-sitter-kotlin
2. Returns null parser
3. TreeSitterIndexer falls back to RegexExtractor
4. Regex extracts basic symbol names only (degraded mode)

**Exception Flow — Parse Error:**
1. Source file has syntax errors
2. tree-sitter returns partial AST with ERROR nodes
3. Parser skips ERROR subtrees, extracts from valid nodes
4. Adds parse errors to ParseResult.errors[]

### UC-2: Extract Kotlin Class Hierarchy

| Field | Value |
|-------|-------|
| Actor | TreeSitterIndexer |
| Trigger | Kotlin file contains class declarations |

**Main Flow:**
1. Parser encounters `class_declaration` node
2. Extracts class name, modifiers (data, sealed, abstract, open, enum)
3. Extracts type parameters from `type_parameters` child
4. Extracts primary constructor parameters from `primary_constructor`
5. Extracts supertype list from `delegation_specifiers`
6. For each supertype: creates `inherits` or `implements` relationship
7. Extracts class body members (functions, properties, companion objects)
8. Sets parent_symbol_id for all members

### UC-3: Extract Kotlin Function Signatures

| Field | Value |
|-------|-------|
| Actor | TreeSitterIndexer |
| Trigger | Kotlin file contains function declarations |

**Main Flow:**
1. Parser encounters `function_declaration` node
2. Checks for `suspend` modifier -> sets isAsync = true
3. Checks for receiver type (extension function) -> stores in metadata
4. Extracts function name from `simple_identifier`
5. Extracts parameters from `function_value_parameters`
6. Extracts return type from `type` node after `:`
7. Extracts modifiers (inline, infix, operator, tailrec, external)
8. Calculates cyclomatic complexity by counting branch nodes
9. Extracts annotations/decorators

---

## 3. Detailed Specifications

### 3.1 AST Node Type Mapping

| Kotlin Construct | tree-sitter Node Type | Symbol Kind |
|-----------------|----------------------|-------------|
| Regular class | `class_declaration` | class |
| Data class | `class_declaration` + `data` modifier | class |
| Sealed class | `class_declaration` + `sealed` modifier | class |
| Enum class | `class_declaration` + `enum` modifier | enum |
| Abstract class | `class_declaration` + `abstract` modifier | class |
| Interface | `class_declaration` + `interface` keyword | interface |
| Object | `object_declaration` | class |
| Companion object | `companion_object` | class |
| Function | `function_declaration` | function |
| Method (in class) | `function_declaration` (parent = class_body) | method |
| Property | `property_declaration` | property |
| Constructor | `primary_constructor` / `secondary_constructor` | constructor |
| Type alias | `type_alias` | type |
| Package | `package_header` | namespace |

### 3.2 Modifier Extraction

| Modifier | AST Location | Output |
|----------|-------------|--------|
| public, private, protected, internal | `visibility_modifier` | modifiers[] |
| abstract, open, final, sealed | `inheritance_modifier` | modifiers[] |
| data, inner, value | `class_modifier` | modifiers[] |
| suspend, inline, infix, operator, tailrec | `function_modifier` | modifiers[] |
| const, lateinit | `property_modifier` | modifiers[] |
| override | `member_modifier` | modifiers[] |

### 3.3 Relationship Extraction Rules

#### 3.3.1 Import Relationships

```
import_header -> import_list -> import_entry
  - simple: "import com.example.Foo" -> { kind: "imports", target: "com.example.Foo" }
  - wildcard: "import com.example.*" -> { kind: "imports", target: "com.example.*", metadata: { wildcard: true } }
  - alias: "import com.example.Foo as Bar" -> { kind: "imports", target: "com.example.Foo", metadata: { alias: "Bar" } }
```

#### 3.3.2 Call Relationships

Detected from `call_expression` nodes:
- `functionName(args)` -> { kind: "calls", target: "functionName" }
- `object.method(args)` -> { kind: "calls", target: "method", metadata: { receiver: "object" } }
- `ClassName()` -> { kind: "calls", target: "ClassName", metadata: { isConstructor: true } }
- `launch { ... }` -> { kind: "calls", target: "launch" }

#### 3.3.3 Inheritance Relationships

From `delegation_specifiers`:
- `class Foo : Bar()` -> { kind: "inherits", target: "Bar" }
- `class Foo : IBar` -> { kind: "implements", target: "IBar" }
- Heuristic: if supertype has `()` -> inherits (class), otherwise -> implements (interface)

#### 3.3.4 Annotation/Decorator Relationships

From `annotation` nodes:
- `@Service` -> { kind: "decorates", target: "Service" }
- `@RequestMapping("/api")` -> { kind: "decorates", target: "RequestMapping", metadata: { args: ["/api"] } }

### 3.4 Cyclomatic Complexity Algorithm

```
complexity = 1  // base
for each node in function body:
  if node.type in ["if_expression", "when_entry", "for_statement",
                    "while_statement", "do_while_statement", "catch_block"]:
    complexity++
  if node.type == "conjunction_expression":  // &&
    complexity++
  if node.type == "disjunction_expression":  // ||
    complexity++
```

**Grading:**
| Complexity | Grade |
|-----------|-------|
| 1-5 | A (simple) |
| 6-10 | B (moderate) |
| 11-20 | C (complex) |
| 21-50 | D (very complex) |
| 50+ | F (untestable) |

### 3.5 Extension Function Handling

Extension functions have a receiver type before the function name:

```kotlin
fun String.toSlug(): String { ... }
```

AST structure: `function_declaration` -> `receiver_type` -> `type`

Output:
```json
{
  "name": "toSlug",
  "kind": "function",
  "modifiers": ["extension"],
  "metadata": { "receiverType": "String" },
  "signature": "fun String.toSlug(): String"
}
```

### 3.6 Data Class Implicit Members

When a data class is detected, generate implicit symbol entries:
- `copy()` — method
- `equals(other: Any?)` — method
- `hashCode()` — method
- `toString()` — method
- `componentN()` — for each constructor parameter

These are marked with `metadata: { implicit: true }`.

---

## 4. Grammar Configuration

Entry in `grammar-config.json`:

```json
{
  "id": "kotlin",
  "extensions": [".kt"],
  "grammarPackage": "tree-sitter-kotlin",
  "parserModule": "./languages/kotlin-parser"
}
```

---

## 5. Error Handling

| Scenario | Behavior |
|----------|----------|
| Grammar package not installed | GrammarRegistry marks "kotlin" as unavailable, regex fallback |
| File with syntax errors | tree-sitter partial AST, skip ERROR nodes, extract valid symbols |
| Extremely large file (>5000 lines) | Parse normally (tree-sitter handles well), log warning if >10s |
| Unsupported Kotlin construct | Skip node, log debug message, continue |
| Circular class hierarchy | Extract relationships as-is, cycle detection is graph engine's job |

---

## 6. Integration Points

| Component | Interface | Direction |
|-----------|-----------|-----------|
| GrammarRegistry (KSA-145) | `getParser(".kt")` -> KotlinParser | Consumed |
| TreeSitterIndexer (KSA-145) | `parser.parse(source, filePath)` -> ParseResult | Provided |
| GraphRepository (KSA-153) | Stores extracted relationships | Downstream |
| CallGraphService (KSA-154) | Queries relationships for Kotlin symbols | Downstream |
| DependencyGraph (KSA-155) | Uses import relationships | Downstream |
| ImpactAnalysis (KSA-156) | Uses all relationship types | Downstream |

---

## 7. Test Scenarios

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| T-1 | Simple class | `class Foo { fun bar() {} }` | 1 class + 1 method, parent-child |
| T-2 | Data class | `data class User(val name: String)` | 1 class + 5 implicit methods |
| T-3 | Sealed class | `sealed class Result` + subclasses | Inheritance relationships |
| T-4 | Extension function | `fun String.toSlug(): String` | Function with receiverType metadata |
| T-5 | Suspend function | `suspend fun fetch(): Data` | Function with isAsync = true |
| T-6 | Imports | 3 import types | 3 import relationships |
| T-7 | Annotations | `@Service class Foo` | decorates relationship |
| T-8 | Complexity | Function with 5 branches | complexity = 6 |
| T-9 | Companion object | `companion object { fun create() }` | Object linked to parent class |
| T-10 | Syntax error | Incomplete file | Partial extraction, errors[] populated |
