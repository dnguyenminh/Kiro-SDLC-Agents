# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-150: [Tree-sitter] Go Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-150 |
| Title | [Tree-sitter] Go Parser |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-150.docx |

---

## 1. Architecture Overview

### 1.1 Component Placement

```
src/
  parsers/
    go/
      index.ts           ← GoParser class
      symbol-extractor.ts
      call-extractor.ts
      import-extractor.ts
      receiver-extractor.ts
      interface-impl-detector.ts
      __tests__/
        go-parser.test.ts
        fixtures/
          simple.go
          methods.go
          interfaces.go
          goroutines.go
```

### 1.2 Class Design

```typescript
class GoParser implements ILanguageParser {
  language = "go";
  extensions = [".go"];
  
  private parser: Parser;
  private symbolExtractor: GoSymbolExtractor;
  private relationshipExtractor: GoRelationshipExtractor;
  private interfaceDetector: InterfaceImplDetector;
  
  parse(source: string, filePath: string): ParseResult {
    const tree = this.parser.parse(source);
    const symbols = this.symbolExtractor.extract(tree.rootNode, filePath);
    const relationships = this.relationshipExtractor.extract(tree.rootNode, symbols);
    
    // Post-parse: detect implicit interface implementations
    const implRelationships = this.interfaceDetector.detect(symbols, relationships);
    
    return { 
      symbols, 
      relationships: [...relationships, ...implRelationships], 
      errors: [] 
    };
  }
}
```

---

## 2. Detailed Design

### 2.1 Symbol Extraction

#### 2.1.1 Function/Method Extraction

```typescript
class GoSymbolExtractor {
  extractFunction(node: SyntaxNode, filePath: string): Symbol {
    const name = node.childForFieldName('name')?.text || '';
    const params = this.extractParams(node.childForFieldName('parameters'));
    const result = this.extractResult(node.childForFieldName('result'));
    
    return {
      name,
      kind: 'function',
      parameters: params,
      return_type: result,
      exported: name[0] === name[0].toUpperCase(),
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      file_path: filePath
    };
  }
  
  extractMethod(node: SyntaxNode, filePath: string): GoSymbol {
    // Method has receiver before name
    const receiverNode = node.childForFieldName('receiver');
    const receiver = this.extractReceiver(receiverNode);
    const name = node.childForFieldName('name')?.text || '';
    const params = this.extractParams(node.childForFieldName('parameters'));
    const result = this.extractResult(node.childForFieldName('result'));
    
    return {
      name,
      kind: 'method',
      receiver: receiver.text,
      receiver_type: receiver.typeName,
      pointer_receiver: receiver.isPointer,
      parameters: params,
      return_type: result,
      exported: name[0] === name[0].toUpperCase(),
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      file_path: filePath
    };
  }
  
  private extractReceiver(node: SyntaxNode): { text: string, typeName: string, isPointer: boolean } {
    const paramDecl = node?.namedChildren[0];
    const typeNode = paramDecl?.childForFieldName('type');
    const isPointer = typeNode?.type === 'pointer_type';
    const typeName = isPointer 
      ? typeNode?.namedChildren[0]?.text || ''
      : typeNode?.text || '';
    
    return { text: paramDecl?.text || '', typeName, isPointer };
  }
}
```

#### 2.1.2 Struct Extraction

```typescript
extractStruct(node: SyntaxNode, filePath: string): Symbol {
  const name = node.childForFieldName('name')?.text || '';
  const typeNode = node.childForFieldName('type');
  
  // Extract fields
  const fields: StructField[] = [];
  const embeddedTypes: string[] = [];
  const fieldList = typeNode?.childForFieldName('field_declaration_list');
  
  if (fieldList) {
    for (const field of fieldList.namedChildren) {
      if (field.type === 'field_declaration') {
        const names = field.descendantsOfType('field_identifier');
        const type = field.childForFieldName('type')?.text || '';
        const tag = field.childForFieldName('tag')?.text || '';
        
        if (names.length === 0) {
          // Embedded type (no field name)
          embeddedTypes.push(type);
        } else {
          for (const n of names) {
            fields.push({ name: n.text, type, tag });
          }
        }
      }
    }
  }
  
  return {
    name,
    kind: 'struct',
    exported: name[0] === name[0].toUpperCase(),
    metadata: { fields, embeddedTypes },
    start_line: node.startPosition.row + 1,
    end_line: node.endPosition.row + 1,
    file_path: filePath
  };
}
```

### 2.2 Relationship Extraction

#### 2.2.1 Call Extraction with Goroutine/Defer Detection

```typescript
class GoCallExtractor {
  extract(funcNode: SyntaxNode, funcSymbol: Symbol): Relationship[] {
    const calls: Relationship[] = [];
    const body = funcNode.childForFieldName('body');
    if (!body) return calls;
    
    // Regular calls
    for (const callExpr of body.descendantsOfType('call_expression')) {
      const target = this.resolveTarget(callExpr);
      calls.push({
        source_symbol: funcSymbol.name,
        target_symbol: target,
        type: 'Calls',
        metadata: { line: callExpr.startPosition.row + 1 }
      });
    }
    
    // Goroutine calls
    for (const goStmt of body.descendantsOfType('go_statement')) {
      const callExpr = goStmt.namedChildren[0];
      if (callExpr?.type === 'call_expression') {
        const target = this.resolveTarget(callExpr);
        calls.push({
          source_symbol: funcSymbol.name,
          target_symbol: target,
          type: 'Calls',
          metadata: { line: goStmt.startPosition.row + 1, async: true }
        });
      }
    }
    
    // Deferred calls
    for (const deferStmt of body.descendantsOfType('defer_statement')) {
      const callExpr = deferStmt.namedChildren[0];
      if (callExpr?.type === 'call_expression') {
        const target = this.resolveTarget(callExpr);
        calls.push({
          source_symbol: funcSymbol.name,
          target_symbol: target,
          type: 'Calls',
          metadata: { line: deferStmt.startPosition.row + 1, deferred: true }
        });
      }
    }
    
    return calls;
  }
}
```

#### 2.2.2 Interface Implementation Detection

```typescript
class InterfaceImplDetector {
  detect(symbols: Symbol[], relationships: Relationship[]): Relationship[] {
    const interfaces = symbols.filter(s => s.kind === 'interface');
    const structs = symbols.filter(s => s.kind === 'struct');
    const implRelationships: Relationship[] = [];
    
    for (const struct of structs) {
      const structMethods = this.getMethodsOf(struct.name, symbols, relationships);
      
      for (const iface of interfaces) {
        const ifaceMethods = this.getInterfaceMethods(iface);
        if (this.satisfies(structMethods, ifaceMethods)) {
          implRelationships.push({
            source_symbol: struct.name,
            target_symbol: iface.name,
            type: 'Implements',
            metadata: { implicit: true }
          });
        }
      }
    }
    
    return implRelationships;
  }
  
  private satisfies(structMethods: MethodSig[], ifaceMethods: MethodSig[]): boolean {
    return ifaceMethods.every(im => 
      structMethods.some(sm => sm.name === im.name && sm.signature === im.signature)
    );
  }
}
```

---

## 3. Go-Specific Handling

### 3.1 Multiple Return Values

Go functions can return multiple values: `func foo() (int, error)`

**Extraction:** Capture full result type as string including parentheses for multiple returns.

### 3.2 Named Returns

`func foo() (result int, err error)` — capture as return type string.

### 3.3 Exported Detection

Simple rule: first character uppercase = exported. Applied to functions, methods, types, constants, variables.

### 3.4 Generated Files

Skip files matching `*_generated.go` or containing `// Code generated` comment in first 3 lines.

---

## 4. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Create GoParser class | `src/parsers/go/index.ts` | 2h |
| 2 | Implement function/method extraction | `src/parsers/go/symbol-extractor.ts` | 3h |
| 3 | Implement struct/interface extraction | `src/parsers/go/symbol-extractor.ts` | 3h |
| 4 | Implement receiver extraction | `src/parsers/go/receiver-extractor.ts` | 2h |
| 5 | Implement call extraction (+ goroutine/defer) | `src/parsers/go/call-extractor.ts` | 3h |
| 6 | Implement import extraction | `src/parsers/go/import-extractor.ts` | 1h |
| 7 | Implement interface impl detection | `src/parsers/go/interface-impl-detector.ts` | 3h |
| 8 | Register in grammar registry | `src/parsers/registry.ts` | 0.5h |
| 9 | Write unit tests | `src/parsers/go/__tests__/` | 4h |
| 10 | Write integration tests | `src/parsers/go/__tests__/` | 2h |

**Total estimated effort:** ~3 days
