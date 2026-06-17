# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-149: [Tree-sitter] Java Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-149 |
| Title | [Tree-sitter] Java Parser |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-149.docx |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the Java language parser implementation using tree-sitter. It defines AST node type mappings to symbols, relationship extraction logic, and Java-specific syntax handling (records, sealed classes, annotations).

### 1.2 Scope

- Java symbol extraction (classes, interfaces, enums, records, methods, fields, annotations)
- Call relationship extraction (method calls, constructor calls, static calls)
- Import relationship extraction (single, wildcard, static)
- Inheritance relationship extraction (extends, implements, permits)
- Annotation usage detection

---

## 2. System Overview

### 2.1 Parser Architecture

```
JavaParser implements ILanguageParser
    │
    ├── SymbolExtractor
    │     ├── ClassExtractor (class, interface, enum, record, annotation_type)
    │     ├── MethodExtractor (method, constructor)
    │     ├── FieldExtractor (field declarations)
    │     └── PackageExtractor (package declaration)
    │
    └── RelationshipExtractor
          ├── CallExtractor (method_invocation, object_creation_expression)
          ├── ImportExtractor (import_declaration)
          ├── InheritanceExtractor (superclass, super_interfaces, permits)
          └── AnnotationExtractor (marker_annotation, annotation)
```

### 2.2 File Extensions

| Extension | Grammar | Notes |
|-----------|---------|-------|
| `.java` | `tree-sitter-java` | All Java source files |

---

## 3. Functional Requirements

### 3.1 Feature: Symbol Extraction

#### 3.1.1 AST Node Type Mapping

| Java Construct | AST Node Type | Extracted Kind | Example |
|---------------|---------------|----------------|---------|
| `class Foo` | `class_declaration` | `class` | `public class UserService extends BaseService` |
| `interface IFoo` | `interface_declaration` | `interface` | `public interface Repository<T>` |
| `enum Status` | `enum_declaration` | `enum` | `public enum OrderStatus { PENDING, DONE }` |
| `record Point` | `record_declaration` | `record` | `public record Point(int x, int y)` |
| `void method()` | `method_declaration` | `method` | `public List<User> findAll(Pageable p)` |
| `Foo()` | `constructor_declaration` | `constructor` | `public UserService(UserRepo repo)` |
| `int field` | `field_declaration` | `field` | `private final String name` |
| `@interface Ann` | `annotation_type_declaration` | `annotation_type` | `public @interface Cacheable` |
| `package x.y` | `package_declaration` | `package` | `package com.example.service` |

#### 3.1.2 Use Case: UC-01 — Extract Class Declaration

**Preconditions:** Java file parsed into AST

**Main Flow:**
1. Find `class_declaration` node
2. Extract `name` from `identifier` child
3. Extract `modifiers` from `modifiers` child (public, abstract, final, static)
4. Extract `type_parameters` from `type_parameters` child (generics)
5. Extract `superclass` from `superclass` child (extends)
6. Extract `super_interfaces` from `super_interfaces` child (implements)
7. Extract `permits` from `permits` child (sealed class)
8. Extract annotations from `annotation` / `marker_annotation` siblings
9. Store symbol with all metadata

**Output:**
```json
{
  "name": "UserService",
  "kind": "class",
  "modifiers": ["public"],
  "generics": "<T extends Entity>",
  "extends": "BaseService<T>",
  "implements": ["IUserService", "Serializable"],
  "annotations": ["@Service", "@Transactional"],
  "start_line": 15,
  "end_line": 120,
  "file": "src/main/java/com/example/UserService.java"
}
```

#### 3.1.3 Use Case: UC-02 — Extract Method Declaration

**Main Flow:**
1. Find `method_declaration` node
2. Extract `name`, `type` (return type), `modifiers`
3. Extract `formal_parameters` → iterate `formal_parameter` children
4. For each parameter: extract type, name, annotations, varargs flag
5. Extract `throws` clause
6. Determine parent class (walk up to `class_declaration`)
7. Set `parent_symbol_id` to enclosing class

**Output:**
```json
{
  "name": "findByEmail",
  "kind": "method",
  "return_type": "Optional<User>",
  "parameters": "(String email)",
  "modifiers": ["public"],
  "annotations": ["@Override", "@Cacheable(\"users\")"],
  "throws": ["NotFoundException"],
  "parent_symbol_id": 42,
  "start_line": 35,
  "end_line": 48
}
```

#### 3.1.4 Use Case: UC-03 — Extract Record Declaration

**Main Flow:**
1. Find `record_declaration` node
2. Extract `name` and `type_parameters`
3. Extract record components from `record_component_list`
4. Each component: type + name (acts as both field and constructor param)
5. Extract `implements` if present
6. Extract compact constructor if present

---

### 3.2 Feature: Relationship Extraction

#### 3.2.1 Call Extraction

**AST Patterns:**

| Pattern | AST Node | Extraction Logic |
|---------|----------|-----------------|
| `obj.method()` | `method_invocation` | object = first child, method = `identifier` |
| `method()` | `method_invocation` | no object qualifier, method = `identifier` |
| `new Foo()` | `object_creation_expression` | type = `type_identifier` |
| `super.method()` | `method_invocation` | object = `super` keyword |
| `Foo.staticMethod()` | `method_invocation` | object = type name |
| `this::method` | `method_reference` | reference to method |

**Pseudocode:**
```
function extractCalls(methodNode):
  calls = []
  for each method_invocation in methodNode.descendants:
    target = getCallTarget(method_invocation)
    calls.push({
      source: methodNode.name,
      target: target,
      type: "Calls",
      line: method_invocation.startPosition.row
    })
  for each object_creation_expression in methodNode.descendants:
    type = getCreatedType(object_creation_expression)
    calls.push({
      source: methodNode.name,
      target: type + ".constructor",
      type: "Calls",
      line: object_creation_expression.startPosition.row
    })
  return calls
```

#### 3.2.2 Import Extraction

**AST Pattern:** `import_declaration` node

**Logic:**
1. Check for `static` modifier
2. Extract full path from `scoped_identifier` or `identifier`
3. Check for wildcard (`asterisk` child)
4. Create import relationship

#### 3.2.3 Inheritance Extraction

**AST Patterns:**
- `superclass` child of `class_declaration` → `inherits` edge
- `super_interfaces` child → `implements` edges (one per interface)
- `extends_interfaces` child of `interface_declaration` → `inherits` edges
- `permits` child of sealed class → `permits` edges

#### 3.2.4 Annotation Extraction

**AST Patterns:**
- `marker_annotation` (no args): `@Override`
- `annotation` (with args): `@Column(name = "id")`

**Logic:**
1. Find annotation nodes preceding declarations
2. Extract annotation name
3. Extract arguments (if `annotation` type)
4. Create `annotated_by` relationship

---

### 3.3 Feature: Java-Specific Handling

#### 3.3.1 Inner Classes

- Nested `class_declaration` inside another → set `parent_symbol_id`
- Anonymous classes (`new Interface() { ... }`) → extract as `anonymous_class` kind
- Static inner classes vs instance inner classes distinguished by `static` modifier

#### 3.3.2 Generics

- Type parameters: `<T extends Comparable<T> & Serializable>`
- Wildcards: `<? extends Number>`, `<? super Integer>`
- Stored as string representation in `generics` field

#### 3.3.3 Lambda Expressions

- Lambda body calls attributed to enclosing method
- Lambda itself not extracted as separate symbol (it's anonymous)
- Method references (`Class::method`) create `uses` relationship

---

## 4. API Contracts

### 4.1 Parser Interface

```typescript
interface ILanguageParser {
  language: string;                    // "java"
  extensions: string[];                // [".java"]
  parse(source: string, filePath: string): ParseResult;
}

interface ParseResult {
  symbols: Symbol[];
  relationships: Relationship[];
  errors: ParseError[];
}

interface Symbol {
  name: string;
  kind: SymbolKind;
  file_path: string;
  start_line: number;
  end_line: number;
  signature: string;
  parameters?: string;
  return_type?: string;
  modifiers?: string[];
  annotations?: string[];
  generics?: string;
  parent_symbol_id?: number;
}

interface Relationship {
  source_symbol: string;
  target_symbol: string;
  type: EdgeType;  // "Calls" | "Imports" | "Inherits" | "Implements" | "Annotated"
  metadata?: Record<string, any>;
}
```

---

## 5. Data Model

### 5.1 Symbols Table (enhanced columns for Java)

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Symbol name |
| kind | TEXT | class/interface/enum/record/method/constructor/field |
| file_path | TEXT | Relative file path |
| start_line | INTEGER | First line |
| end_line | INTEGER | Last line |
| signature | TEXT | Full signature string |
| parameters | TEXT | Parameter list |
| return_type | TEXT | Return type |
| modifiers | TEXT | JSON array of modifiers |
| annotations | TEXT | JSON array of annotations |
| generics | TEXT | Generic type parameters |
| parent_symbol_id | INTEGER FK | Enclosing class/interface |
| package_name | TEXT | Java package |

---

## 6. Non-Functional Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Parse speed | <15ms per file (<1000 lines) | Benchmark test |
| Memory | <50MB for parser instance | Process monitoring |
| Accuracy (symbols) | >95% | Test against reference corpus |
| Accuracy (calls) | >80% | Test against reference corpus |
| Error tolerance | Graceful on syntax errors | tree-sitter error recovery |

---

## 7. Error Handling

| Error | Handling |
|-------|----------|
| Syntax error in Java file | tree-sitter produces partial AST, extract what's available |
| Unknown AST node type | Skip with warning log |
| File too large (>10K lines) | Parse with timeout, extract top-level only |
| Grammar not loaded | Fallback to regex extraction |

---

## 8. Test Strategy

| Test Type | Coverage |
|-----------|----------|
| Unit tests | Each extractor (class, method, field, import, call, inheritance) |
| Integration tests | Full file parse → verify all symbols + relationships |
| Accuracy tests | Parse real Java projects, compare with expected output |
| Performance tests | Benchmark 100 files, verify <15ms average |
| Edge cases | Generics, inner classes, lambdas, records, sealed classes |
