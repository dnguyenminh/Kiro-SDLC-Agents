# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-147: [Tree-sitter] Kotlin Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-147 |
| Title | [Tree-sitter] Kotlin Parser |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-147.docx |
| Related TDD | TDD-v1-KSA-145.docx (Core), TDD-v1-KSA-153.docx (Data Model) |

---

## 1. Architecture Overview

### 1.1 Component Position

```
GrammarRegistry (KSA-145)
    |
    +-- getParser(".kt") --> KotlinParser (THIS TICKET)
    |                           |
    |                           +-- parse(source, filePath) --> ParseResult
    |                                   |
    |                                   +-- symbols: ExtractedSymbol[]
    |                                   +-- relationships: ExtractedRelationship[]
    |                                   +-- errors: ParseError[]
    |
    +-- getParser(".ts") --> TypeScriptParser (KSA-146, reference impl)
```

The KotlinParser implements the `ILanguageParser` interface defined in KSA-145 and follows the same pattern as TypeScriptParser (KSA-146).

### 1.2 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Grammar | tree-sitter-kotlin | Kotlin AST generation |
| AST Utils | ast-utils.ts (KSA-145) | Tree walking, node finding |
| Interface | ILanguageParser | Standard parser contract |
| Storage | SQLite (KSA-153 schema) | Symbol + relationship storage |

---

## 2. Detailed Design

### 2.1 Module: KotlinParser

**File:** `src/parsers/languages/kotlin-parser.ts`

```typescript
import Parser, { SyntaxNode } from 'tree-sitter';
import { ILanguageParser, ParseResult, ExtractedSymbol, ExtractedRelationship, SymbolKind } from '../types';
import { walkTree, findNodes, getNodeText, getNodeRange, getAncestorOfType, getChildrenOfType } from '../ast-utils';

export default class KotlinParser implements ILanguageParser {
  readonly languageId = 'kotlin';
  private parser: Parser;

  constructor(parser: Parser) {
    this.parser = parser;
  }

  getSupportedExtensions(): string[] {
    return ['.kt'];
  }

  parse(source: string, filePath: string): ParseResult {
    const tree = this.parser.parse(source);
    const symbols: ExtractedSymbol[] = [];
    const relationships: ExtractedRelationship[] = [];
    const errors: ParseError[] = [];

    // Collect parse errors
    this.collectErrors(tree.rootNode, errors);

    // Extract package
    this.extractPackage(tree.rootNode, source, filePath, symbols);

    // Extract imports
    this.extractImports(tree.rootNode, source, filePath, relationships);

    // Extract declarations (classes, functions, properties, objects)
    this.extractDeclarations(tree.rootNode, source, filePath, symbols, relationships);

    return { symbols, relationships, errors };
  }

  private extractPackage(root: SyntaxNode, source: string, filePath: string, symbols: ExtractedSymbol[]): void {
    const pkgNode = root.children.find(c => c.type === 'package_header');
    if (pkgNode) {
      const identifier = findFirst(pkgNode, 'identifier');
      if (identifier) {
        symbols.push({
          name: getNodeText(identifier, source),
          kind: 'namespace',
          filePath,
          ...getNodeRange(pkgNode),
          signature: getNodeText(pkgNode, source).trim()
        });
      }
    }
  }

  private extractImports(root: SyntaxNode, source: string, filePath: string, relationships: ExtractedRelationship[]): void {
    const imports = findNodes(root, 'import_header');
    for (const imp of imports) {
      const identifier = findFirst(imp, 'identifier');
      if (!identifier) continue;

      const target = getNodeText(identifier, source);
      const isWildcard = imp.children.some(c => c.type === 'STAR' || getNodeText(c, source) === '*');
      const aliasNode = findFirst(imp, 'import_alias');
      const alias = aliasNode ? getNodeText(aliasNode.children[1], source) : undefined;

      relationships.push({
        sourceSymbol: '__file__',
        targetSymbol: isWildcard ? target + '.*' : target,
        kind: 'imports',
        line: imp.startPosition.row + 1,
        metadata: {
          ...(isWildcard && { wildcard: true }),
          ...(alias && { alias })
        }
      });
    }
  }

  private extractDeclarations(
    node: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[], relationships: ExtractedRelationship[],
    parentName?: string
  ): void {
    for (const child of node.children) {
      switch (child.type) {
        case 'class_declaration':
          this.extractClass(child, source, filePath, symbols, relationships, parentName);
          break;
        case 'object_declaration':
          this.extractObject(child, source, filePath, symbols, relationships, parentName);
          break;
        case 'function_declaration':
          this.extractFunction(child, source, filePath, symbols, relationships, parentName);
          break;
        case 'property_declaration':
          this.extractProperty(child, source, filePath, symbols, relationships, parentName);
          break;
        case 'type_alias':
          this.extractTypeAlias(child, source, filePath, symbols, parentName);
          break;
      }
    }
  }

  private extractClass(
    node: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[], relationships: ExtractedRelationship[],
    parentName?: string
  ): void {
    const nameNode = node.children.find(c => c.type === 'type_identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const modifiers = this.extractModifiers(node, source);
    const isInterface = node.children.some(c => getNodeText(c, source) === 'interface');
    const isEnum = modifiers.includes('enum');
    const isData = modifiers.includes('data');

    const kind: SymbolKind = isInterface ? 'interface' : isEnum ? 'enum' : 'class';

    // Extract type parameters
    const typeParams = this.extractTypeParameters(node, source);

    // Extract primary constructor parameters
    const params = this.extractPrimaryConstructor(node, source);

    // Extract supertypes
    const delegationSpecs = findFirst(node, 'delegation_specifiers');
    if (delegationSpecs) {
      this.extractSupertypes(delegationSpecs, source, name, filePath, relationships);
    }

    // Extract annotations
    this.extractAnnotations(node, source, name, filePath, relationships);

    symbols.push({
      name,
      kind,
      filePath,
      ...getNodeRange(node),
      signature: this.buildClassSignature(modifiers, kind, name, typeParams, params),
      parameters: params,
      modifiers,
      parentName,
      isExported: !modifiers.includes('private'),
      decorators: this.getAnnotationNames(node, source)
    });

    // Extract class body members
    const classBody = findFirst(node, 'class_body');
    if (classBody) {
      this.extractDeclarations(classBody, source, filePath, symbols, relationships, name);
      // Extract companion objects
      const companions = findNodes(classBody, 'companion_object');
      for (const comp of companions) {
        this.extractCompanionObject(comp, source, filePath, symbols, relationships, name);
      }
    }

    // Generate implicit members for data classes
    if (isData) {
      this.generateDataClassMembers(name, filePath, node, symbols);
    }
  }

  private extractFunction(
    node: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[], relationships: ExtractedRelationship[],
    parentName?: string
  ): void {
    const nameNode = node.children.find(c => c.type === 'simple_identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const modifiers = this.extractModifiers(node, source);
    const isSuspend = modifiers.includes('suspend');

    // Check for receiver type (extension function)
    const receiverType = this.extractReceiverType(node, source);

    // Extract parameters
    const params = this.extractFunctionParameters(node, source);

    // Extract return type
    const returnType = this.extractReturnType(node, source);

    // Calculate complexity
    const body = findFirst(node, 'function_body');
    const complexity = body ? this.calculateComplexity(body) : 1;

    // Extract annotations
    this.extractAnnotations(node, source, name, filePath, relationships);

    const kind: SymbolKind = parentName ? 'method' : 'function';

    symbols.push({
      name,
      kind,
      filePath,
      ...getNodeRange(node),
      signature: this.buildFunctionSignature(modifiers, receiverType, name, params, returnType),
      parameters: params,
      returnType,
      modifiers: receiverType ? [...modifiers, 'extension'] : modifiers,
      parentName,
      isAsync: isSuspend,
      isExported: !modifiers.includes('private'),
      complexity,
      decorators: this.getAnnotationNames(node, source),
      metadata: receiverType ? { receiverType } : undefined
    });

    // Extract call relationships from function body
    if (body) {
      this.extractCalls(body, source, name, filePath, relationships);
    }
  }

  private calculateComplexity(node: SyntaxNode): number {
    let complexity = 1;
    const branchTypes = new Set([
      'if_expression', 'when_entry', 'for_statement',
      'while_statement', 'do_while_statement', 'catch_block'
    ]);
    const logicalTypes = new Set(['conjunction_expression', 'disjunction_expression']);

    walkTree(node, {
      enter(n) {
        if (branchTypes.has(n.type)) complexity++;
        if (logicalTypes.has(n.type)) complexity++;
      }
    });

    return complexity;
  }

  private extractCalls(
    node: SyntaxNode, source: string, sourceName: string,
    filePath: string, relationships: ExtractedRelationship[]
  ): void {
    const callExprs = findNodes(node, 'call_expression');
    for (const call of callExprs) {
      const target = this.resolveCallTarget(call, source);
      if (target) {
        relationships.push({
          sourceSymbol: sourceName,
          targetSymbol: target.name,
          kind: 'calls',
          line: call.startPosition.row + 1,
          metadata: target.metadata
        });
      }
    }
  }

  private resolveCallTarget(node: SyntaxNode, source: string): { name: string; metadata?: Record<string, unknown> } | null {
    const firstChild = node.child(0);
    if (!firstChild) return null;

    if (firstChild.type === 'navigation_expression') {
      // object.method() pattern
      const parts = getNodeText(firstChild, source).split('.');
      const method = parts[parts.length - 1];
      const receiver = parts.slice(0, -1).join('.');
      return { name: method, metadata: { receiver } };
    }

    if (firstChild.type === 'simple_identifier') {
      const name = getNodeText(firstChild, source);
      // Check if constructor call (starts with uppercase)
      if (name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase()) {
        return { name, metadata: { isConstructor: true } };
      }
      return { name };
    }

    return null;
  }

  private extractModifiers(node: SyntaxNode, source: string): string[] {
    const modifiers: string[] = [];
    const modifierNodes = findNodes(node, 'modifiers');
    for (const modNode of modifierNodes) {
      // Only direct child modifiers, not nested
      if (modNode.parent === node || modNode.parent?.parent === node) {
        for (const child of modNode.children) {
          const text = getNodeText(child, source).trim();
          if (text && !text.startsWith('@')) {
            modifiers.push(text);
          }
        }
      }
    }
    return modifiers;
  }

  private extractReceiverType(node: SyntaxNode, source: string): string | undefined {
    const receiverNode = node.children.find(c => c.type === 'receiver_type');
    if (receiverNode) {
      return getNodeText(receiverNode, source).trim();
    }
    return undefined;
  }

  private extractSupertypes(
    node: SyntaxNode, source: string, className: string,
    filePath: string, relationships: ExtractedRelationship[]
  ): void {
    for (const child of node.children) {
      if (child.type === 'delegation_specifier') {
        const text = getNodeText(child, source).trim();
        const hasParens = text.includes('(');
        const typeName = text.replace(/\(.*\)/, '').trim();

        relationships.push({
          sourceSymbol: className,
          targetSymbol: typeName,
          kind: hasParens ? 'inherits' : 'implements',
          line: child.startPosition.row + 1
        });
      }
    }
  }
}
```

---

## 3. File Structure

```
src/parsers/languages/
└── kotlin-parser.ts          # Main parser implementation (~400 lines)

tests/parsers/languages/
├── kotlin-parser.test.ts     # Unit tests
└── fixtures/
    ├── simple-class.kt       # Test fixture
    ├── data-class.kt
    ├── sealed-hierarchy.kt
    ├── extension-functions.kt
    ├── suspend-functions.kt
    ├── imports-all-types.kt
    ├── annotations.kt
    ├── complex-function.kt
    ├── companion-object.kt
    └── syntax-error.kt
```

---

## 4. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Install tree-sitter-kotlin grammar | package.json | 0.5h |
| 2 | Add kotlin config to grammar-config.json | src/parsers/grammar-config.json | 0.25h |
| 3 | Implement KotlinParser class (core) | src/parsers/languages/kotlin-parser.ts | 4h |
| 4 | Implement symbol extraction (classes, functions, properties) | kotlin-parser.ts | 3h |
| 5 | Implement relationship extraction (calls, imports, inheritance) | kotlin-parser.ts | 3h |
| 6 | Implement complexity calculation | kotlin-parser.ts | 1h |
| 7 | Implement extension function handling | kotlin-parser.ts | 1h |
| 8 | Implement data class implicit members | kotlin-parser.ts | 1h |
| 9 | Create test fixtures (.kt files) | tests/parsers/languages/fixtures/ | 1h |
| 10 | Unit tests for symbol extraction | tests/parsers/languages/kotlin-parser.test.ts | 2h |
| 11 | Unit tests for relationships | tests/parsers/languages/kotlin-parser.test.ts | 2h |
| 12 | Integration test with TreeSitterIndexer | tests/parsers/indexer-kotlin.test.ts | 1.5h |
| 13 | Performance benchmark | tests/benchmarks/kotlin-parse-perf.ts | 0.5h |

**Total estimated effort:** ~21 hours (2.5 days)

---

## 5. Performance Design

| Concern | Mitigation |
|---------|-----------|
| Large Kotlin files (>2000 lines) | tree-sitter handles efficiently, no special handling needed |
| Many call expressions | Limit call extraction to direct calls (no lambda body deep traversal) |
| Data class implicit members | Generated in-memory, minimal overhead |
| Complexity calculation | Single pass over function body AST |

### Expected Performance

| File Size | Symbols | Parse Time |
|-----------|---------|-----------|
| 100 lines | ~10 | < 5ms |
| 500 lines | ~50 | < 10ms |
| 1000 lines | ~100 | < 15ms |
| 2000 lines | ~200 | < 30ms |

---

## 6. Error Handling

| Error | Strategy | Recovery |
|-------|----------|----------|
| tree-sitter-kotlin not installed | Catch require() error | Regex fallback |
| Parse error in source | Partial AST extraction | Skip ERROR nodes |
| Unknown node type | Log debug, skip | Continue with next node |
| Null child node | Defensive null checks | Skip symbol |
| Extremely deep nesting | walkTree uses iterative stack | No stack overflow |

---

## 7. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Malicious .kt files | tree-sitter has bounded parsing |
| Path traversal | File paths validated by TreeSitterIndexer |
| Memory exhaustion | Parser instances are lightweight |

---

## 8. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit | Each extraction method | Test with fixture .kt files |
| Integration | Full parse pipeline | Index real Kotlin project files |
| Regression | Output stability | Snapshot tests for known files |
| Performance | Parse speed | Benchmark against 100-file corpus |

---

## 9. Dependencies on Other Tickets

| Ticket | What's Used | Status |
|--------|------------|--------|
| KSA-145 | ILanguageParser, GrammarRegistry, ast-utils, TreeSitterIndexer | Done |
| KSA-146 | TypeScriptParser as reference implementation pattern | Done |
| KSA-153 | relationships table schema, GraphRepository | Done |
