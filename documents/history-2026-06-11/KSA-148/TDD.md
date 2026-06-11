# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-148: [Tree-sitter] Python Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-148 |
| Title | [Tree-sitter] Python Parser |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-148.docx |
| Related TDD | TDD-v1-KSA-145.docx (Core), TDD-v1-KSA-147.docx (Kotlin - sibling) |

---

## 1. Architecture Overview

Same architecture as KSA-147 (Kotlin Parser). PythonParser implements `ILanguageParser` and plugs into GrammarRegistry.

```
GrammarRegistry
    +-- getParser(".py") --> PythonParser (THIS TICKET)
    +-- getParser(".kt") --> KotlinParser (KSA-147)
    +-- getParser(".ts") --> TypeScriptParser (KSA-146)
```

---

## 2. Detailed Design

### 2.1 Module: PythonParser

**File:** `src/parsers/languages/python-parser.ts`

```typescript
import Parser, { SyntaxNode } from 'tree-sitter';
import { ILanguageParser, ParseResult, ExtractedSymbol, ExtractedRelationship } from '../types';
import { walkTree, findNodes, getNodeText, getNodeRange } from '../ast-utils';

export default class PythonParser implements ILanguageParser {
  readonly languageId = 'python';
  private parser: Parser;

  constructor(parser: Parser) {
    this.parser = parser;
  }

  getSupportedExtensions(): string[] {
    return ['.py', '.pyi'];
  }

  parse(source: string, filePath: string): ParseResult {
    const tree = this.parser.parse(source);
    const symbols: ExtractedSymbol[] = [];
    const relationships: ExtractedRelationship[] = [];
    const errors: ParseError[] = [];

    this.collectErrors(tree.rootNode, errors);
    this.extractImports(tree.rootNode, source, filePath, relationships);
    this.extractDeclarations(tree.rootNode, source, filePath, symbols, relationships);

    return { symbols, relationships, errors };
  }

  private extractImports(root: SyntaxNode, source: string, filePath: string, rels: ExtractedRelationship[]): void {
    // import_statement: import os, import os.path
    const importStmts = findNodes(root, 'import_statement');
    for (const stmt of importStmts) {
      const names = findNodes(stmt, 'dotted_name');
      for (const name of names) {
        const target = getNodeText(name, source);
        const aliasNode = name.nextSibling?.type === 'as' ? name.nextSibling.nextSibling : null;
        rels.push({
          sourceSymbol: '__file__',
          targetSymbol: target,
          kind: 'imports',
          line: stmt.startPosition.row + 1,
          metadata: aliasNode ? { alias: getNodeText(aliasNode, source) } : undefined
        });
      }
    }

    // import_from_statement: from x import y
    const fromStmts = findNodes(root, 'import_from_statement');
    for (const stmt of fromStmts) {
      const moduleNode = stmt.children.find(c => c.type === 'dotted_name' || c.type === 'relative_import');
      const moduleName = moduleNode ? getNodeText(moduleNode, source) : '';
      const isRelative = moduleName.startsWith('.');
      const level = isRelative ? moduleName.match(/^\.+/)?.[0].length || 0 : 0;

      // Check for wildcard
      if (stmt.children.some(c => c.type === 'wildcard_import')) {
        rels.push({
          sourceSymbol: '__file__',
          targetSymbol: `${moduleName}.*`,
          kind: 'imports',
          line: stmt.startPosition.row + 1,
          metadata: { wildcard: true, ...(isRelative && { relative: true, level }) }
        });
        continue;
      }

      // Named imports
      const importedNames = findNodes(stmt, 'aliased_import');
      for (const imported of importedNames) {
        const name = getNodeText(imported.child(0)!, source);
        const alias = imported.childCount > 2 ? getNodeText(imported.child(2)!, source) : undefined;
        rels.push({
          sourceSymbol: '__file__',
          targetSymbol: `${moduleName}.${name}`,
          kind: 'imports',
          line: stmt.startPosition.row + 1,
          metadata: {
            from: moduleName,
            name,
            ...(alias && { alias }),
            ...(isRelative && { relative: true, level })
          }
        });
      }
    }
  }

  private extractDeclarations(
    node: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[], rels: ExtractedRelationship[],
    parentName?: string
  ): void {
    for (const child of node.children) {
      if (child.type === 'function_definition') {
        this.extractFunction(child, source, filePath, symbols, rels, parentName);
      } else if (child.type === 'class_definition') {
        this.extractClass(child, source, filePath, symbols, rels, parentName);
      } else if (child.type === 'decorated_definition') {
        // Unwrap decorated definition
        const inner = child.children.find(c =>
          c.type === 'function_definition' || c.type === 'class_definition'
        );
        if (inner) {
          if (inner.type === 'function_definition') {
            this.extractFunction(inner, source, filePath, symbols, rels, parentName, child);
          } else {
            this.extractClass(inner, source, filePath, symbols, rels, parentName, child);
          }
        }
      } else if (child.type === 'expression_statement' && !parentName) {
        // Module-level assignments (variables)
        this.extractModuleVariable(child, source, filePath, symbols);
      }
    }
  }

  private extractFunction(
    node: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[], rels: ExtractedRelationship[],
    parentName?: string, decoratedNode?: SyntaxNode
  ): void {
    const nameNode = node.children.find(c => c.type === 'identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const isAsync = node.parent?.type === 'function_definition'
      ? false
      : source.substring(node.startIndex - 6, node.startIndex).includes('async');

    // Extract decorators
    const decorators = this.extractDecorators(decoratedNode || node, source, name, filePath, rels);

    // Determine kind
    let kind: SymbolKind = parentName ? 'method' : 'function';
    if (decorators.includes('property')) kind = 'property';
    if (decorators.includes('staticmethod') || decorators.includes('classmethod')) kind = 'method';

    // Extract parameters
    const paramsNode = node.children.find(c => c.type === 'parameters');
    const params = paramsNode ? this.extractParameters(paramsNode, source) : '';

    // Extract return type
    const returnTypeNode = node.children.find(c => c.type === 'type');
    const returnType = returnTypeNode ? getNodeText(returnTypeNode, source) : undefined;

    // Modifiers
    const modifiers: string[] = [];
    if (isAsync) modifiers.push('async');
    if (decorators.includes('staticmethod')) modifiers.push('static');
    if (decorators.includes('classmethod')) modifiers.push('classmethod');
    if (decorators.includes('abstractmethod')) modifiers.push('abstract');

    // Complexity
    const body = node.children.find(c => c.type === 'block');
    const complexity = body ? this.calculateComplexity(body) : 1;

    symbols.push({
      name,
      kind,
      filePath,
      ...getNodeRange(node),
      signature: this.buildSignature(isAsync, name, params, returnType),
      parameters: params,
      returnType,
      modifiers,
      parentName,
      isAsync,
      isExported: !name.startsWith('_'),
      complexity,
      decorators
    });

    // Extract calls from body
    if (body) {
      this.extractCalls(body, source, name, filePath, rels);
    }

    // Extract nested functions
    if (body) {
      this.extractDeclarations(body, source, filePath, symbols, rels, name);
    }
  }

  private extractClass(
    node: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[], rels: ExtractedRelationship[],
    parentName?: string, decoratedNode?: SyntaxNode
  ): void {
    const nameNode = node.children.find(c => c.type === 'identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const decorators = this.extractDecorators(decoratedNode || node, source, name, filePath, rels);

    // Extract base classes
    const argList = node.children.find(c => c.type === 'argument_list');
    const bases: string[] = [];
    let isProtocol = false;
    let isABC = false;

    if (argList) {
      for (const arg of argList.children) {
        if (arg.type === 'identifier' || arg.type === 'attribute') {
          const baseName = getNodeText(arg, source);
          bases.push(baseName);
          if (baseName === 'Protocol') isProtocol = true;
          if (baseName === 'ABC' || baseName === 'ABCMeta') isABC = true;

          rels.push({
            sourceSymbol: name,
            targetSymbol: baseName,
            kind: isProtocol ? 'implements' : 'inherits',
            line: arg.startPosition.row + 1
          });
        }
      }
    }

    const kind: SymbolKind = isProtocol ? 'interface' : 'class';
    const modifiers: string[] = [];
    if (isABC) modifiers.push('abstract');
    if (decorators.includes('dataclass')) modifiers.push('dataclass');

    symbols.push({
      name,
      kind,
      filePath,
      ...getNodeRange(node),
      signature: `class ${name}${bases.length ? `(${bases.join(', ')})` : ''}`,
      modifiers,
      parentName,
      isExported: !name.startsWith('_'),
      decorators
    });

    // Extract class body
    const body = node.children.find(c => c.type === 'block');
    if (body) {
      this.extractDeclarations(body, source, filePath, symbols, rels, name);
    }
  }

  private calculateComplexity(node: SyntaxNode): number {
    let complexity = 1;
    const branchTypes = new Set([
      'if_statement', 'elif_clause', 'for_statement', 'while_statement',
      'except_clause', 'with_statement', 'case_clause', 'assert_statement'
    ]);

    walkTree(node, {
      enter(n) {
        if (branchTypes.has(n.type)) complexity++;
        if (n.type === 'boolean_operator') complexity++;
        if (n.type === 'conditional_expression') complexity++;
        if (['list_comprehension', 'set_comprehension',
             'dictionary_comprehension', 'generator_expression'].includes(n.type)) {
          complexity++;
        }
      }
    });

    return complexity;
  }
}
```

---

## 3. File Structure

```
src/parsers/languages/
└── python-parser.ts          # Main parser (~350 lines)

tests/parsers/languages/
├── python-parser.test.ts     # Unit tests
└── fixtures/
    ├── simple-function.py
    ├── async-function.py
    ├── class-hierarchy.py
    ├── protocol-class.py
    ├── decorators.py
    ├── imports-all-types.py
    ├── dataclass.py
    ├── property-methods.py
    ├── nested-functions.py
    └── complex-function.py
```

---

## 4. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Install tree-sitter-python | package.json | 0.25h |
| 2 | Add python config to grammar-config.json | grammar-config.json | 0.25h |
| 3 | Implement PythonParser core | src/parsers/languages/python-parser.ts | 3h |
| 4 | Implement import extraction (all patterns) | python-parser.ts | 2h |
| 5 | Implement class extraction (Protocol, ABC, dataclass) | python-parser.ts | 2.5h |
| 6 | Implement function extraction (async, decorators, type hints) | python-parser.ts | 2.5h |
| 7 | Implement call extraction | python-parser.ts | 1.5h |
| 8 | Implement complexity calculation | python-parser.ts | 1h |
| 9 | Create test fixtures | tests/fixtures/ | 1h |
| 10 | Unit tests | python-parser.test.ts | 3h |
| 11 | Integration test | tests/parsers/indexer-python.test.ts | 1.5h |
| 12 | Performance benchmark | tests/benchmarks/python-parse-perf.ts | 0.5h |

**Total estimated effort:** ~19 hours (2.5 days)

---

## 5. Performance Design

| File Size | Expected Parse Time |
|-----------|-------------------|
| 100 lines | < 3ms |
| 500 lines | < 7ms |
| 1000 lines | < 10ms |
| 2000 lines | < 20ms |

Python files tend to be shorter than Kotlin/Java due to less boilerplate.

---

## 6. Error Handling

| Error | Strategy |
|-------|----------|
| IndentationError in source | tree-sitter partial AST, extract valid blocks |
| Missing type hints | Extract params without types |
| Complex decorator expressions | Extract name only |
| f-string parsing issues | Skip, not relevant for symbols |
| Walrus operator (:=) | Handled by tree-sitter-python grammar |

---

## 7. Dependencies

| Ticket | What's Used |
|--------|------------|
| KSA-145 | ILanguageParser, GrammarRegistry, ast-utils |
| KSA-146 | TypeScriptParser as reference pattern |
| KSA-153 | relationships table schema |
