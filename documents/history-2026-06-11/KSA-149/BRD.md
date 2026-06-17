# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-149: [Tree-sitter] Java Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-149 |
| Title | [Tree-sitter] Java Parser |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-01 | BA Agent | Initial document — auto-generated from Jira ticket KSA-149 |

---

## 1. Introduction

### 1.1 Scope

Implement tree-sitter parser for Java that extracts:
- **Symbols**: classes, interfaces, enums, records, methods, constructors, fields, annotations, packages
- **Relationships**: calls, imports, inheritance (extends/implements), annotation usage

This parser builds on the tree-sitter core infrastructure (KSA-145) and follows the same architecture as sibling parsers (KSA-146 TypeScript, KSA-147 Kotlin, KSA-148 Python).

### 1.2 Out of Scope

- Tree-sitter core infrastructure (KSA-145 — prerequisite, done)
- Other language parsers (TypeScript → KSA-146, Kotlin → KSA-147, Python → KSA-148)
- Graph storage (KSA-153 — parallel work)
- Call graph query tools (KSA-154)
- Complexity analysis (separate ticket)
- Java bytecode analysis or runtime reflection

### 1.3 Preliminary Requirements

- Tree-sitter core integration complete (KSA-145)
- `tree-sitter-java` grammar package installed
- Base `TreeSitterParser` interface available from KSA-145
- Graph data model (KSA-153) for relationship storage

---

## 2. Business Requirements

### 2.1 High Level Process Map

Current regex extraction for Java captures only 4 patterns (method, class, interface, enum) with names only. The tree-sitter parser will extract:
- Full symbol metadata (params with types, return types, modifiers, annotations, generics)
- All relationship types (calls, imports, inheritance, annotation usage)
- Package structure and visibility analysis
- Inner class and anonymous class detection

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a developer, I want all Java symbol types extracted with full metadata | MUST HAVE | KSA-149 |
| 2 | As a developer, I want method call relationships extracted so call graphs work | MUST HAVE | KSA-149 |
| 3 | As a developer, I want import relationships extracted for dependency analysis | MUST HAVE | KSA-149 |
| 4 | As a developer, I want class inheritance relationships (extends/implements) extracted | MUST HAVE | KSA-149 |
| 5 | As a developer, I want annotation usage detected for framework analysis (Spring, JPA, etc.) | SHOULD HAVE | KSA-149 |
| 6 | As a developer, I want Java records and sealed classes properly handled | SHOULD HAVE | KSA-149 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Indexer encounters a `.java` file

**Step 2:** Grammar registry (KSA-145) loads `tree-sitter-java`

**Step 3:** File is parsed into AST

**Step 4:** Java parser walks AST extracting symbols (classes, methods, fields, etc.)

**Step 5:** Java parser walks AST extracting relationships (calls, imports, inheritance)

**Step 6:** Symbols stored in `symbols` table, relationships in `relationships` table (KSA-153)

---

#### STORY 1: Java Symbol Extraction

> As a developer, I want all Java symbol types extracted with full metadata so AI agents understand the codebase structure.

**Symbol Types to Extract:**

| Symbol Type | AST Node Type | Metadata Extracted |
|-------------|---------------|-------------------|
| Class | `class_declaration` | name, modifiers, extends, implements, generics, abstract, final |
| Interface | `interface_declaration` | name, extends, generics, sealed |
| Enum | `enum_declaration` | name, implements, constants |
| Record | `record_declaration` | name, components, implements |
| Method | `method_declaration` | name, params, return_type, modifiers, throws, annotations |
| Constructor | `constructor_declaration` | name, params, modifiers, throws |
| Field | `field_declaration` | name, type, modifiers, initial_value |
| Annotation type | `annotation_type_declaration` | name, elements |
| Package | `package_declaration` | name |
| Inner class | `class_declaration` (nested) | name, static, parent_class |

**Acceptance Criteria:**

1. All 10 symbol types correctly extracted from Java files
2. Parameters include names, types, and annotations (e.g., `@NotNull String name`)
3. Return types captured including generics (e.g., `List<String>`)
4. Modifiers (public, private, protected, static, final, abstract, synchronized, volatile) captured
5. Generic type parameters captured (e.g., `<T extends Comparable<T>>`)
6. Nested/inner classes have correct parent_symbol_id
7. Annotations on symbols captured (e.g., `@Override`, `@Deprecated`)

---

#### STORY 2: Method Call Extraction

> As a developer, I want method call relationships extracted so that call graph tools can show who calls whom.

**Call Patterns to Detect:**

| Pattern | Example | Extracted As |
|---------|---------|-------------|
| Direct call | `foo()` | calls → `foo` |
| Method call | `obj.method()` | calls → `obj.method` |
| Static call | `Math.abs(x)` | calls → `Math.abs` |
| Chained call | `builder.set().build()` | calls → `builder.set`, calls → `[result].build` |
| Constructor | `new ArrayList<>()` | calls → `ArrayList.constructor` |
| Super call | `super.method()` | calls → `[parent].method` |
| This call | `this.method()` | calls → `[self].method` |
| Lambda body | `list.stream().map(x -> transform(x))` | calls → `list.stream`, calls → `transform` |

**Acceptance Criteria:**

1. Direct method calls detected with correct target symbol name
2. Method calls include object qualifier (e.g., `this.method`, `service.call`)
3. Static method calls include class name (e.g., `Collections.sort`)
4. Constructor calls (`new X()`) detected
5. Calls within method bodies correctly attributed to the containing method
6. Lambda/anonymous class calls attributed to enclosing method
7. At least 80% of call patterns in typical Java code detected

---

#### STORY 3: Import Extraction

> As a developer, I want import relationships extracted for dependency analysis.

**Import Patterns:**

| Pattern | Example | Extracted As |
|---------|---------|-------------|
| Single import | `import java.util.List` | imports → `java.util.List` |
| Wildcard import | `import java.util.*` | imports → `java.util.*` |
| Static import | `import static Math.abs` | imports → `Math.abs` (static) |
| Static wildcard | `import static org.junit.Assert.*` | imports → `org.junit.Assert.*` (static) |

**Acceptance Criteria:**

1. All import patterns correctly detected with full qualified name
2. Static imports marked with `static: true` metadata
3. Wildcard imports preserved as-is (resolution is separate concern)
4. Package declaration creates `belongs_to` relationship

---

#### STORY 4: Inheritance Extraction

> As a developer, I want class inheritance relationships (extends/implements) extracted for type hierarchy analysis.

**Patterns:**

| Pattern | Example | Extracted As |
|---------|---------|-------------|
| Class extends | `class Dog extends Animal` | inherits → `Animal` |
| Class implements | `class Service implements IService` | implements → `IService` |
| Interface extends | `interface Admin extends User, Serializable` | inherits → `User`, inherits → `Serializable` |
| Multiple implements | `class X implements A, B, C` | implements → `A`, `B`, `C` |
| Generic extends | `class List<T extends Comparable<T>>` | type_constraint → `Comparable` |
| Enum implements | `enum Status implements Displayable` | implements → `Displayable` |
| Record implements | `record Point(int x, int y) implements Serializable` | implements → `Serializable` |

**Acceptance Criteria:**

1. `extends` relationships detected for classes and interfaces
2. `implements` relationships detected for classes, enums, records
3. Multiple inheritance targets each create separate edges
4. Generic type constraints detected as relationships
5. Sealed class `permits` clause detected

---

#### STORY 5: Annotation Usage Detection

> As a developer, I want annotation usage detected for framework analysis (Spring, JPA, etc.).

**Annotation Patterns:**

| Pattern | Example | Extracted As |
|---------|---------|-------------|
| Class annotation | `@Entity class User` | annotated_by → `Entity` |
| Method annotation | `@GetMapping("/users")` | annotated_by → `GetMapping` |
| Field annotation | `@Column(name="id")` | annotated_by → `Column` |
| Parameter annotation | `@RequestBody User user` | param_annotated_by → `RequestBody` |
| Multiple annotations | `@Service @Transactional` | annotated_by → `Service`, `Transactional` |

**Acceptance Criteria:**

1. Annotations on classes, methods, fields, and parameters detected
2. Annotation arguments captured (e.g., `value="/users"`)
3. Meta-annotations (annotations on annotations) detected
4. Common framework annotations recognized: Spring (`@Service`, `@Controller`, `@Repository`), JPA (`@Entity`, `@Table`), Lombok (`@Data`, `@Builder`)

---

#### STORY 6: Java Records and Sealed Classes

> As a developer, I want Java records and sealed classes properly handled as first-class symbols.

**Acceptance Criteria:**

1. Records extracted with component list (name + type for each)
2. Record compact constructors detected
3. Sealed classes extracted with `permits` list
4. Sealed interfaces extracted with `permits` list
5. Pattern matching in switch/instanceof not required (future enhancement)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Tree-sitter core (KSA-145) | System | KSA-145 | Base parser infrastructure |
| tree-sitter-java | External | N/A | Java grammar package |
| Graph data model (KSA-153) | System | KSA-153 | Relationships table for storing edges |
| KSA-146 (TypeScript parser) | Reference | KSA-146 | Architecture reference |
| KSA-147 (Kotlin parser) | Reference | KSA-147 | Sibling JVM language reference |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve extraction scope |
| Developer | Code Intelligence Team | Implement Java parser |
| QA | QA Team | Verify extraction accuracy |
| Users | AI Agent developers | Consume enriched Java data |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Complex Java generics not fully parsed | Medium | Medium | Focus on common patterns, iterate |
| tree-sitter-java grammar lags behind Java 21+ features | Medium | Low | Pin grammar version, contribute upstream |
| Anonymous classes create complex nesting | Low | Medium | Limit depth, attribute to enclosing method |
| Large Java files (>5K lines, enterprise code) | Low | Medium | Benchmark, optimize traversal |

### 5.2 Assumptions

- tree-sitter-java grammar covers Java 17+ syntax (records, sealed classes, text blocks)
- Call detection at 80% accuracy is acceptable for v1
- Unresolved types (external libraries) stored as string references
- Annotation argument parsing is best-effort (complex expressions may be simplified)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Parse + extract <15ms per file | For files under 1000 lines |
| Accuracy | Symbol extraction >95% | Compared to manual analysis |
| Accuracy | Call detection >80% | For direct and method calls |
| Accuracy | Import detection >99% | Import patterns are well-defined |
| Coverage | Java 17+ syntax | Including records, sealed, text blocks |

---

## 7. Related Tickets

| Ticket Key | Summary | Relationship |
|------------|---------|--------------|
| KSA-149 | [Tree-sitter] Java Parser | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | Parent epic |
| KSA-145 | [Tree-sitter] Core Integration | Prerequisite |
| KSA-146 | [Tree-sitter] TypeScript/JavaScript Parser | Sibling (reference impl) |
| KSA-147 | [Tree-sitter] Kotlin Parser | Sibling (JVM language) |
| KSA-153 | [Graph] Data Model & Storage | Storage for relationships |
| KSA-154 | [Graph] Call Graph | Consumes call relationships |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| AST | Abstract Syntax Tree — parsed representation of source code |
| Record | Java 16+ immutable data class (`record Point(int x, int y)`) |
| Sealed class | Java 17+ restricted inheritance (`sealed class Shape permits Circle, Square`) |
| Annotation | Metadata marker (`@Override`, `@Entity`) |
| Generics | Type parameterization (`List<T>`, `Map<K, V>`) |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| KSA-145 BRD (Core) | documents/KSA-145/BRD.md |
| KSA-146 BRD (TypeScript) | documents/KSA-146/BRD.md |
| tree-sitter-java | https://github.com/tree-sitter/tree-sitter-java |
