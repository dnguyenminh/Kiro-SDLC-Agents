# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-151: [Tree-sitter] Rust Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-151 |
| Title | [Tree-sitter] Rust Parser |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-151.docx |

---

## 1. Architecture Overview

### 1.1 Component Placement

```
src/
  parsers/
    rust/
      index.ts           ← RustParser class
      symbol-extractor.ts
      call-extractor.ts
      use-extractor.ts
      impl-extractor.ts
      module-extractor.ts
      __tests__/
        rust-parser.test.ts
        fixtures/
          simple.rs
          traits.rs
          impl_blocks.rs
          modules.rs
          macros.rs
```

### 1.2 Class Design

```typescript
class RustParser implements ILanguageParser {
  language = "rust";
  extensions = [".rs"];
  
  private parser: Parser;
  private symbolExtractor: RustSymbolExtractor;
  private relationshipExtractor: RustRelationshipExtractor;
  
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

#### 2.1.1 Function Extraction

```typescript
extractFunction(node: SyntaxNode, filePath: string, parentId?: number): Symbol {
  const name = node.childForFieldName('name')?.text || '';
  const visibility = this.extractVisibility(node);
  const modifiers = this.extractFunctionModifiers(node); // async, unsafe, const
  const typeParams = node.childForFieldName('type_parameters')?.text || '';
  const params = this.extractParams(node.childForFieldName('parameters'));
  const returnType = node.childForFieldName('return_type')?.text?.replace('->', '').trim() || '';
  const whereClause = node.descendantsOfType('where_clause')[0]?.text || '';
  
  return {
    name,
    kind: 'function',
    visibility,
    modifiers,
    generics: typeParams,
    parameters: params,
    return_type: returnType,
    where_clause: whereClause,
    is_async: modifiers.includes('async'),
    is_unsafe: modifiers.includes('unsafe'),
    parent_symbol_id: parentId,
    start_line: node.startPosition.row + 1,
    end_line: node.endPosition.row + 1,
    file_path: filePath
  };
}
```

#### 2.1.2 Impl Block Extraction

```typescript
extractImpl(node: SyntaxNode, filePath: string): { implSymbol: Symbol, methods: Symbol[], relationships: Relationship[] } {
  const typeParams = node.childForFieldName('type_parameters')?.text || '';
  
  // Determine if trait impl or inherent impl
  const traitNode = node.childForFieldName('trait');
  const typeNode = node.childForFieldName('type');
  const targetType = typeNode?.text || '';
  const traitName = traitNode?.text || '';
  
  const implSymbol: Symbol = {
    name: traitName ? `impl ${traitName} for ${targetType}` : `impl ${targetType}`,
    kind: 'impl',
    generics: typeParams,
    metadata: { target_type: targetType, trait: traitName || null },
    start_line: node.startPosition.row + 1,
    end_line: node.endPosition.row + 1,
    file_path: filePath
  };
  
  // Extract methods within impl block
  const methods: Symbol[] = [];
  const body = node.childForFieldName('body');
  if (body) {
    for (const item of body.namedChildren) {
      if (item.type === 'function_item') {
        const method = this.extractFunction(item, filePath, implSymbol.id);
        method.kind = 'method';
        method.metadata = { ...method.metadata, impl_target: targetType, impl_trait: traitName };
        methods.push(method);
      }
    }
  }
  
  // Create relationships
  const relationships: Relationship[] = [];
  if (traitName) {
    relationships.push({
      source_symbol: targetType,
      target_symbol: traitName,
      type: 'Implements'
    });
  }
  for (const method of methods) {
    relationships.push({
      source_symbol: method.name,
      target_symbol: targetType,
      type: 'Contains'
    });
  }
  
  return { implSymbol, methods, relationships };
}
```

#### 2.1.3 Derive Macro Extraction

```typescript
extractDerives(node: SyntaxNode, symbolName: string): Relationship[] {
  const relationships: Relationship[] = [];
  
  // Find #[derive(...)] attributes
  for (const attr of node.descendantsOfType('attribute_item')) {
    const attrContent = attr.text;
    const deriveMatch = attrContent.match(/derive\(([^)]+)\)/);
    if (deriveMatch) {
      const traits = deriveMatch[1].split(',').map(t => t.trim());
      for (const trait of traits) {
        relationships.push({
          source_symbol: symbolName,
          target_symbol: trait,
          type: 'Implements',
          metadata: { derived: true }
        });
      }
    }
  }
  
  return relationships;
}
```

### 2.2 Use (Import) Extraction

#### 2.2.1 Recursive Use Path Expansion

```typescript
class RustUseExtractor {
  extract(rootNode: SyntaxNode): Relationship[] {
    const relationships: Relationship[] = [];
    
    for (const useDecl of rootNode.descendantsOfType('use_declaration')) {
      const isPublic = useDecl.children.some(c => c.type === 'visibility_modifier');
      const argument = useDecl.childForFieldName('argument');
      if (argument) {
        const paths = this.expandUsePath(argument, '');
        for (const path of paths) {
          relationships.push({
            source_symbol: '__file__',
            target_symbol: path.fullPath,
            type: 'Imports',
            metadata: { 
              alias: path.alias, 
              pub_use: isPublic,
              glob: path.glob 
            }
          });
        }
      }
    }
    
    return relationships;
  }
  
  private expandUsePath(node: SyntaxNode, prefix: string): UsePath[] {
    switch (node.type) {
      case 'scoped_identifier':
        return [{ fullPath: node.text, alias: null, glob: false }];
      
      case 'use_as_clause':
        const path = node.childForFieldName('path')?.text || '';
        const alias = node.childForFieldName('alias')?.text || '';
        return [{ fullPath: path, alias, glob: false }];
      
      case 'use_wildcard':
        return [{ fullPath: `${prefix}*`, alias: null, glob: true }];
      
      case 'use_list':
        // Grouped: {A, B, C}
        const results: UsePath[] = [];
        for (const child of node.namedChildren) {
          results.push(...this.expandUsePath(child, prefix));
        }
        return results;
      
      case 'scoped_use_list':
        // std::{io, fs}
        const scopePath = node.childForFieldName('path')?.text || '';
        const list = node.childForFieldName('list');
        const newPrefix = prefix ? `${prefix}::${scopePath}::` : `${scopePath}::`;
        if (list) {
          return this.expandUsePath(list, newPrefix);
        }
        return [{ fullPath: `${newPrefix}`, alias: null, glob: false }];
      
      default:
        return [{ fullPath: prefix + node.text, alias: null, glob: false }];
    }
  }
}
```

### 2.3 Call Extraction

```typescript
class RustCallExtractor {
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
    
    // Macro invocations
    for (const macroInv of body.descendantsOfType('macro_invocation')) {
      const macroName = macroInv.childForFieldName('macro')?.text || '';
      calls.push({
        source_symbol: funcSymbol.name,
        target_symbol: macroName.replace('!', ''),
        type: 'Calls',
        metadata: { line: macroInv.startPosition.row + 1, macro: true }
      });
    }
    
    // .await expressions
    for (const awaitExpr of body.descendantsOfType('await_expression')) {
      calls.push({
        source_symbol: funcSymbol.name,
        target_symbol: '[async].poll',
        type: 'Calls',
        metadata: { line: awaitExpr.startPosition.row + 1, async: true }
      });
    }
    
    return calls;
  }
}
```

---

## 3. Rust-Specific Handling

### 3.1 Visibility Modifiers

| Syntax | Extracted As |
|--------|-------------|
| (none) | `"private"` |
| `pub` | `"pub"` |
| `pub(crate)` | `"pub_crate"` |
| `pub(super)` | `"pub_super"` |
| `pub(in path)` | `"pub_in"` |

### 3.2 Lifetimes

Captured as strings in `lifetimes` field. No validation or analysis.

### 3.3 Macros

- `macro_rules!` definitions → extracted as `macro` kind symbol
- Macro invocations → extracted as `Calls` relationship with `macro: true`
- Procedural macro attributes (`#[derive(...)]`, `#[tokio::main]`) → extracted as annotations

### 3.4 Module Hierarchy

- `mod foo;` (file module) → creates module symbol, `Contains` relationship to file
- `mod foo { ... }` (inline module) → creates module symbol with children

---

## 4. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Create RustParser class | `src/parsers/rust/index.ts` | 2h |
| 2 | Implement function extraction (+ async/unsafe/const) | `src/parsers/rust/symbol-extractor.ts` | 3h |
| 3 | Implement struct/enum/trait extraction | `src/parsers/rust/symbol-extractor.ts` | 3h |
| 4 | Implement impl block extraction | `src/parsers/rust/impl-extractor.ts` | 4h |
| 5 | Implement use path expansion (grouped/nested) | `src/parsers/rust/use-extractor.ts` | 3h |
| 6 | Implement call extraction (+ macros) | `src/parsers/rust/call-extractor.ts` | 3h |
| 7 | Implement derive macro → implements | `src/parsers/rust/symbol-extractor.ts` | 1h |
| 8 | Implement module hierarchy | `src/parsers/rust/module-extractor.ts` | 2h |
| 9 | Register in grammar registry | `src/parsers/registry.ts` | 0.5h |
| 10 | Write unit tests | `src/parsers/rust/__tests__/` | 4h |
| 11 | Write integration tests | `src/parsers/rust/__tests__/` | 2h |

**Total estimated effort:** ~3.5 days
