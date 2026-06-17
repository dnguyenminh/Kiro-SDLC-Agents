# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-149: [Tree-sitter] Java Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-149 |
| Title | [Tree-sitter] Java Parser |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-149.docx |

---

## 1. Architecture Overview

### 1.1 Component Placement

The Java parser is a language plugin within the tree-sitter parser infrastructure (KSA-145). It implements the `ILanguageParser` interface and registers itself in the grammar registry.

```
src/
  parsers/
    base.ts              ← ILanguageParser interface (KSA-145)
    registry.ts          ← Grammar registry (KSA-145)
    java/
      index.ts           ← JavaParser class (this ticket)
      symbol-extractor.ts
      call-extractor.ts
      import-extractor.ts
      inheritance-extractor.ts
      annotation-extractor.ts
      __tests__/
        java-parser.test.ts
        fixtures/
          SimpleClass.java
          Generics.java
          Records.java
          Annotations.java
```

### 1.2 Class Design

```typescript
class JavaParser implements ILanguageParser {
  language = "java";
  extensions = [".java"];
  
  private parser: Parser;  // tree-sitter Parser instance
  private symbolExtractor: JavaSymbolExtractor;
  private relationshipExtractor: JavaRelationshipExtractor;
  
  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(require('tree-sitter-java'));
    this.symbolExtractor = new JavaSymbolExtractor();
    this.relationshipExtractor = new JavaRelationshipExtractor();
  }
  
  parse(source: string, filePath: string): ParseResult {
    const tree = this.parser.parse(source);
    const symbols = this.symbolExtractor.extract(tree.rootNode, filePath);
    const relationships = this.relationshipExtractor.extract(tree.rootNode, symbols);
    return { symbols, relationships, errors: [] };
  }
}
```

---

## 2. Detailed Design

### 2.1 Symbol Extraction

#### 2.1.1 JavaSymbolExtractor

```typescript
class JavaSymbolExtractor {
  extract(rootNode: SyntaxNode, filePath: string): Symbol[] {
    const symbols: Symbol[] = [];
    
    // Package declaration
    const packageNode = rootNode.descendantsOfType('package_declaration')[0];
    if (packageNode) {
      symbols.push(this.extractPackage(packageNode, filePath));
    }
    
    // Walk top-level declarations
    for (const child of rootNode.namedChildren) {
      switch (child.type) {
        case 'class_declaration':
        case 'interface_declaration':
        case 'enum_declaration':
        case 'record_declaration':
        case 'annotation_type_declaration':
          symbols.push(...this.extractTypeDeclaration(child, filePath, null));
          break;
      }
    }
    
    return symbols;
  }
  
  private extractTypeDeclaration(node: SyntaxNode, filePath: string, parentId: number | null): Symbol[] {
    const symbols: Symbol[] = [];
    const typeSymbol = this.extractType(node, filePath, parentId);
    symbols.push(typeSymbol);
    
    // Extract members (methods, fields, inner classes)
    const body = node.childForFieldName('body');
    if (body) {
      for (const member of body.namedChildren) {
        switch (member.type) {
          case 'method_declaration':
          case 'constructor_declaration':
            symbols.push(this.extractMethod(member, filePath, typeSymbol.id));
            break;
          case 'field_declaration':
            symbols.push(...this.extractFields(member, filePath, typeSymbol.id));
            break;
          case 'class_declaration':
          case 'interface_declaration':
          case 'enum_declaration':
            symbols.push(...this.extractTypeDeclaration(member, filePath, typeSymbol.id));
            break;
        }
      }
    }
    
    return symbols;
  }
}
```

#### 2.1.2 Method Parameter Extraction

```typescript
private extractParameters(paramsNode: SyntaxNode): string {
  if (!paramsNode) return "()";
  const params: string[] = [];
  
  for (const param of paramsNode.namedChildren) {
    if (param.type === 'formal_parameter' || param.type === 'spread_parameter') {
      const type = param.childForFieldName('type')?.text || '';
      const name = param.childForFieldName('name')?.text || '';
      const annotations = param.descendantsOfType('annotation').map(a => a.text);
      const prefix = annotations.length ? annotations.join(' ') + ' ' : '';
      const spread = param.type === 'spread_parameter' ? '...' : '';
      params.push(`${prefix}${type}${spread} ${name}`);
    }
  }
  
  return `(${params.join(', ')})`;
}
```

### 2.2 Relationship Extraction

#### 2.2.1 Call Extraction

```typescript
class JavaCallExtractor {
  extract(rootNode: SyntaxNode, symbols: Symbol[]): Relationship[] {
    const relationships: Relationship[] = [];
    
    // For each method/constructor, find calls within its body
    for (const symbol of symbols.filter(s => s.kind === 'method' || s.kind === 'constructor')) {
      const methodNode = this.findNodeForSymbol(rootNode, symbol);
      if (!methodNode) continue;
      
      const body = methodNode.childForFieldName('body');
      if (!body) continue;
      
      // method_invocation nodes
      for (const call of body.descendantsOfType('method_invocation')) {
        const target = this.resolveCallTarget(call);
        relationships.push({
          source_symbol: symbol.name,
          target_symbol: target,
          type: 'Calls',
          metadata: { line: call.startPosition.row + 1 }
        });
      }
      
      // object_creation_expression (new X())
      for (const creation of body.descendantsOfType('object_creation_expression')) {
        const type = creation.childForFieldName('type')?.text || '';
        relationships.push({
          source_symbol: symbol.name,
          target_symbol: `${type}.constructor`,
          type: 'Calls',
          metadata: { line: creation.startPosition.row + 1, constructor: true }
        });
      }
    }
    
    return relationships;
  }
  
  private resolveCallTarget(callNode: SyntaxNode): string {
    const object = callNode.childForFieldName('object');
    const name = callNode.childForFieldName('name')?.text || '';
    
    if (object) {
      return `${object.text}.${name}`;
    }
    return name;
  }
}
```

#### 2.2.2 Import Extraction

```typescript
class JavaImportExtractor {
  extract(rootNode: SyntaxNode): Relationship[] {
    const relationships: Relationship[] = [];
    
    for (const importNode of rootNode.descendantsOfType('import_declaration')) {
      const isStatic = importNode.children.some(c => c.type === 'static');
      const path = importNode.descendantsOfType('scoped_identifier')[0]?.text 
                || importNode.descendantsOfType('identifier')[0]?.text || '';
      const isWildcard = importNode.children.some(c => c.type === 'asterisk');
      
      relationships.push({
        source_symbol: '__file__',
        target_symbol: isWildcard ? `${path}.*` : path,
        type: 'Imports',
        metadata: { static: isStatic, wildcard: isWildcard }
      });
    }
    
    return relationships;
  }
}
```

---

## 3. Database Schema Changes

No new tables. Uses existing `symbols` and `relationships` tables from KSA-153.

**New values for `kind` column:** `record`, `annotation_type`

**New values for `edge_type` column:** `Annotated`

---

## 4. Performance Considerations

| Concern | Solution |
|---------|----------|
| Large Java files (>5K lines) | Stream AST traversal, don't load full tree in memory |
| Many inner classes | Recursive extraction with depth limit (10 levels) |
| Annotation-heavy code (Spring) | Batch annotation extraction per declaration |
| Parser instance reuse | Single Parser instance per language, reused across files |

---

## 5. Testing Strategy

### 5.1 Test Fixtures

Create Java test files covering:
- `SimpleClass.java` — basic class with methods and fields
- `Generics.java` — complex generics, wildcards, bounded types
- `Records.java` — records, sealed classes, pattern matching
- `Annotations.java` — Spring/JPA annotations with arguments
- `InnerClasses.java` — nested, static inner, anonymous classes
- `Lambdas.java` — lambda expressions, method references

### 5.2 Accuracy Verification

For each fixture, maintain expected output JSON. Test compares extracted symbols/relationships against expected.

---

## 6. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Create JavaParser class | `src/parsers/java/index.ts` | 2h |
| 2 | Implement symbol extraction (class, interface, enum) | `src/parsers/java/symbol-extractor.ts` | 4h |
| 3 | Implement method/constructor extraction | `src/parsers/java/symbol-extractor.ts` | 3h |
| 4 | Implement record/sealed class extraction | `src/parsers/java/symbol-extractor.ts` | 2h |
| 5 | Implement call extraction | `src/parsers/java/call-extractor.ts` | 4h |
| 6 | Implement import extraction | `src/parsers/java/import-extractor.ts` | 1h |
| 7 | Implement inheritance extraction | `src/parsers/java/inheritance-extractor.ts` | 2h |
| 8 | Implement annotation extraction | `src/parsers/java/annotation-extractor.ts` | 2h |
| 9 | Register in grammar registry | `src/parsers/registry.ts` | 0.5h |
| 10 | Write unit tests | `src/parsers/java/__tests__/` | 4h |
| 11 | Write integration tests | `src/parsers/java/__tests__/` | 2h |
| 12 | Performance benchmark | `src/parsers/java/__tests__/` | 1h |

**Total estimated effort:** ~3 days
