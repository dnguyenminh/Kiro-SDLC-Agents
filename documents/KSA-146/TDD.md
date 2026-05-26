# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-146: [Tree-sitter] TypeScript/JavaScript Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-146 |
| Title | [Tree-sitter] TypeScript/JavaScript Parser |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-146.docx |

---

## 1. Architecture Overview

### 1.1 Parser Module Structure

```
src/parsers/languages/
├── typescript-parser.ts      # Main parser class
├── ts-symbol-extractor.ts    # Symbol extraction logic
├── ts-call-extractor.ts      # Call relationship extraction
├── ts-import-extractor.ts    # Import/export extraction
├── ts-inheritance-extractor.ts # extends/implements extraction
└── ts-utils.ts               # TypeScript-specific AST helpers
```

### 1.2 Class Diagram

```
ILanguageParser (interface)
    │
    ▼
TypeScriptParser
    ├── symbolExtractor: TSSymbolExtractor
    ├── callExtractor: TSCallExtractor
    ├── importExtractor: TSImportExtractor
    └── inheritanceExtractor: TSInheritanceExtractor

Each extractor uses:
    - AST utilities (from ast-utils.ts)
    - TypeScript-specific helpers (from ts-utils.ts)
```

---

## 2. Detailed Design

### 2.1 Module: TypeScriptParser

**File:** `src/parsers/languages/typescript-parser.ts`

```typescript
import Parser, { SyntaxNode } from 'tree-sitter';
import { ILanguageParser, ParseResult, ExtractedSymbol, ExtractedRelationship } from '../types';
import { TSSymbolExtractor } from './ts-symbol-extractor';
import { TSCallExtractor } from './ts-call-extractor';
import { TSImportExtractor } from './ts-import-extractor';
import { TSInheritanceExtractor } from './ts-inheritance-extractor';

export class TypeScriptParser implements ILanguageParser {
  readonly languageId = 'typescript';
  private parser: Parser;
  private symbolExtractor: TSSymbolExtractor;
  private callExtractor: TSCallExtractor;
  private importExtractor: TSImportExtractor;
  private inheritanceExtractor: TSInheritanceExtractor;

  constructor(parser: Parser) {
    this.parser = parser;
    this.symbolExtractor = new TSSymbolExtractor();
    this.callExtractor = new TSCallExtractor();
    this.importExtractor = new TSImportExtractor();
    this.inheritanceExtractor = new TSInheritanceExtractor();
  }

  parse(source: string, filePath: string): ParseResult {
    const tree = this.parser.parse(source);
    const rootNode = tree.rootNode;
    
    const symbols = this.symbolExtractor.extract(rootNode, source, filePath);
    const calls = this.callExtractor.extract(rootNode, source, symbols);
    const imports = this.importExtractor.extract(rootNode, source, filePath);
    const inheritance = this.inheritanceExtractor.extract(rootNode, source, symbols);
    
    const relationships = [...calls, ...imports, ...inheritance];
    const errors = this.collectErrors(tree);
    
    return { symbols, relationships, errors };
  }

  getSupportedExtensions(): string[] {
    return ['.ts', '.tsx'];
  }
}
```

### 2.2 Module: TSSymbolExtractor

**File:** `src/parsers/languages/ts-symbol-extractor.ts`

```typescript
export class TSSymbolExtractor {
  extract(rootNode: SyntaxNode, source: string, filePath: string): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];
    
    this.extractFunctions(rootNode, source, filePath, symbols, null);
    this.extractClasses(rootNode, source, filePath, symbols);
    this.extractInterfaces(rootNode, source, filePath, symbols);
    this.extractTypeAliases(rootNode, source, filePath, symbols);
    this.extractEnums(rootNode, source, filePath, symbols);
    this.extractArrowFunctions(rootNode, source, filePath, symbols);
    
    return symbols;
  }

  private extractFunctions(node: SyntaxNode, source: string, filePath: string, 
                           symbols: ExtractedSymbol[], parentName: string | null): void {
    const funcNodes = findNodes(node, 'function_declaration');
    
    for (const funcNode of funcNodes) {
      const nameNode = funcNode.childForFieldName('name');
      if (!nameNode) continue;
      
      const name = getNodeText(nameNode, source);
      const params = this.extractParameters(funcNode, source);
      const returnType = this.extractReturnType(funcNode, source);
      const isAsync = funcNode.children.some(c => c.type === 'async');
      const isExported = this.isExported(funcNode);
      const docComment = this.extractDocComment(funcNode, source);
      const range = getNodeRange(funcNode);
      
      symbols.push({
        name,
        kind: 'function',
        filePath,
        startLine: range.startLine,
        endLine: range.endLine,
        signature: this.buildSignature(name, params, returnType, isAsync),
        parameters: params,
        returnType,
        modifiers: this.extractModifiers(funcNode, source),
        isAsync,
        isExported,
        docComment,
        parentName
      });
    }
  }

  private extractParameters(funcNode: SyntaxNode, source: string): string {
    const paramsNode = funcNode.childForFieldName('parameters');
    if (!paramsNode) return '()';
    return getNodeText(paramsNode, source);
  }

  private extractReturnType(funcNode: SyntaxNode, source: string): string | undefined {
    const returnTypeNode = funcNode.childForFieldName('return_type');
    if (!returnTypeNode) return undefined;
    // Skip the ': ' prefix
    const text = getNodeText(returnTypeNode, source);
    return text.startsWith(':') ? text.substring(1).trim() : text;
  }
}
```

### 2.3 Module: TSCallExtractor

**File:** `src/parsers/languages/ts-call-extractor.ts`

```typescript
export class TSCallExtractor {
  extract(rootNode: SyntaxNode, source: string, symbols: ExtractedSymbol[]): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];
    
    // For each function/method symbol, find calls within its body
    for (const symbol of symbols) {
      if (!['function', 'method', 'constructor'].includes(symbol.kind)) continue;
      
      // Find the AST node for this symbol
      const symbolNode = this.findSymbolNode(rootNode, symbol);
      if (!symbolNode) continue;
      
      const bodyNode = symbolNode.childForFieldName('body');
      if (!bodyNode) continue;
      
      // Find all call_expression nodes within body
      const callNodes = findNodes(bodyNode, 'call_expression');
      
      for (const callNode of callNodes) {
        const target = this.resolveCallTarget(callNode, source);
        if (!target) continue;
        
        relationships.push({
          sourceSymbol: symbol.parentName ? `${symbol.parentName}.${symbol.name}` : symbol.name,
          targetSymbol: target,
          kind: 'calls',
          line: callNode.startPosition.row + 1
        });
      }
      
      // Find new_expression nodes (constructor calls)
      const newNodes = findNodes(bodyNode, 'new_expression');
      for (const newNode of newNodes) {
        const constructor = this.resolveNewTarget(newNode, source);
        if (!constructor) continue;
        
        relationships.push({
          sourceSymbol: symbol.parentName ? `${symbol.parentName}.${symbol.name}` : symbol.name,
          targetSymbol: `${constructor}.constructor`,
          kind: 'calls',
          line: newNode.startPosition.row + 1
        });
      }
    }
    
    return relationships;
  }

  private resolveCallTarget(callNode: SyntaxNode, source: string): string | null {
    const funcNode = callNode.childForFieldName('function');
    if (!funcNode) return null;
    
    switch (funcNode.type) {
      case 'identifier':
        return getNodeText(funcNode, source);
      case 'member_expression':
        return this.resolveMemberExpression(funcNode, source);
      default:
        return null; // Complex expression, skip
    }
  }

  private resolveMemberExpression(node: SyntaxNode, source: string): string {
    const object = node.childForFieldName('object');
    const property = node.childForFieldName('property');
    if (!object || !property) return getNodeText(node, source);
    
    const objText = object.type === 'member_expression' 
      ? this.resolveMemberExpression(object, source)
      : getNodeText(object, source);
    
    return `${objText}.${getNodeText(property, source)}`;
  }
}
```

### 2.4 Module: TSImportExtractor

**File:** `src/parsers/languages/ts-import-extractor.ts`

```typescript
export class TSImportExtractor {
  extract(rootNode: SyntaxNode, source: string, filePath: string): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];
    const importNodes = findNodes(rootNode, 'import_statement');
    
    for (const importNode of importNodes) {
      const sourceModule = this.getImportSource(importNode, source);
      if (!sourceModule) continue;
      
      const specifiers = this.getImportSpecifiers(importNode, source);
      const line = importNode.startPosition.row + 1;
      
      if (specifiers.length === 0) {
        // Side-effect import: import './styles.css'
        relationships.push({
          sourceSymbol: filePath,
          targetSymbol: sourceModule,
          kind: 'imports',
          line,
          metadata: { type: 'side-effect' }
        });
      } else {
        for (const spec of specifiers) {
          relationships.push({
            sourceSymbol: filePath,
            targetSymbol: `${sourceModule}.${spec.name}`,
            kind: 'imports',
            line,
            metadata: spec.alias ? { alias: spec.alias } : undefined
          });
        }
      }
    }
    
    // Also handle require() calls
    this.extractRequires(rootNode, source, filePath, relationships);
    
    return relationships;
  }
}
```

---

## 3. AST Node Type Reference

### 3.1 Key TypeScript AST Nodes

| Node Type | Represents | Key Children |
|-----------|-----------|--------------|
| `function_declaration` | `function foo()` | name, parameters, return_type, body |
| `arrow_function` | `() => {}` | parameters, return_type, body |
| `class_declaration` | `class Foo` | name, type_parameters, class_heritage, body |
| `method_definition` | `method()` | name, parameters, return_type, body |
| `interface_declaration` | `interface IFoo` | name, type_parameters, extends_clause, body |
| `type_alias_declaration` | `type Foo = ...` | name, type_parameters, value |
| `enum_declaration` | `enum Foo` | name, body |
| `call_expression` | `foo()` | function, arguments |
| `new_expression` | `new Foo()` | constructor, arguments |
| `import_statement` | `import ...` | import_clause, source |
| `member_expression` | `obj.prop` | object, property |

---

## 4. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | TypeScriptParser main class | src/parsers/languages/typescript-parser.ts | 2h |
| 2 | Symbol extractor (functions, classes) | src/parsers/languages/ts-symbol-extractor.ts | 4h |
| 3 | Call extractor | src/parsers/languages/ts-call-extractor.ts | 3h |
| 4 | Import/export extractor | src/parsers/languages/ts-import-extractor.ts | 2h |
| 5 | Inheritance extractor | src/parsers/languages/ts-inheritance-extractor.ts | 1.5h |
| 6 | TypeScript-specific utilities | src/parsers/languages/ts-utils.ts | 1.5h |
| 7 | JavaScript parser (extends TS) | src/parsers/languages/javascript-parser.ts | 1h |
| 8 | Unit tests (symbol extraction) | tests/parsers/ts-symbols.test.ts | 3h |
| 9 | Unit tests (call extraction) | tests/parsers/ts-calls.test.ts | 2h |
| 10 | Unit tests (imports) | tests/parsers/ts-imports.test.ts | 1.5h |
| 11 | Fixture files (real TS code) | tests/fixtures/typescript/ | 1h |
| 12 | Accuracy benchmark | tests/benchmarks/ts-accuracy.ts | 1.5h |

**Total estimated effort:** ~24 hours (3 days)

---

## 5. Testing Strategy

### 5.1 Fixture-Based Testing

Create real TypeScript files as test fixtures:

```
tests/fixtures/typescript/
├── simple-functions.ts      # Basic function declarations
├── arrow-functions.ts       # Arrow functions, async, generators
├── classes.ts              # Classes with methods, inheritance
├── interfaces.ts           # Interfaces, type aliases
├── imports-exports.ts      # All import/export patterns
├── jsx-components.tsx      # React components
├── complex-calls.ts        # Chained calls, callbacks
└── edge-cases.ts           # Decorators, generics, overloads
```

### 5.2 Accuracy Metrics

For each fixture file, maintain expected output:
- Expected symbol count
- Expected relationship count
- Specific symbols that MUST be found
- Specific calls that MUST be detected
