"use strict";
/**
 * KSA-148: Python Language Parser.
 * Extracts symbols and relationships from Python AST using tree-sitter.
 * Supports: classes (Protocol, ABC, dataclass), functions (async, decorators),
 * imports (all patterns), type hints, complexity calculation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ast_utils_js_1 = require("../ast-utils.js");
class PythonParser {
    languageId;
    parser;
    constructor(parser, languageId) {
        this.parser = parser;
        this.languageId = languageId;
    }
    getSupportedExtensions() {
        return ['.py', '.pyi'];
    }
    parse(source, filePath) {
        const tree = this.parser.parse(source);
        const symbols = [];
        const relationships = [];
        const errors = [];
        if (tree.rootNode.hasError()) {
            const errorNodes = (0, ast_utils_js_1.findNodes)(tree.rootNode, 'ERROR');
            for (const node of errorNodes.slice(0, 10)) {
                errors.push({
                    message: 'Parse error',
                    line: node.startPosition.row + 1,
                    column: node.startPosition.column,
                });
            }
        }
        this.extractImports(tree.rootNode, source, filePath, relationships);
        this.extractDeclarations(tree.rootNode, source, filePath, null, symbols, relationships);
        return { symbols, relationships, errors };
    }
    // ─── Import Extraction ───────────────────────────────────────────────
    extractImports(root, source, filePath, relationships) {
        // import_statement: import os, import os.path
        const importStmts = (0, ast_utils_js_1.findNodes)(root, 'import_statement');
        for (const stmt of importStmts) {
            const names = (0, ast_utils_js_1.findNodes)(stmt, 'dotted_name');
            for (const name of names) {
                const target = (0, ast_utils_js_1.getNodeText)(name, source);
                relationships.push({
                    sourceSymbol: '__file__',
                    targetSymbol: target,
                    kind: 'imports',
                    filePath,
                    line: stmt.startPosition.row + 1,
                });
            }
        }
        // import_from_statement: from x import y
        const fromStmts = (0, ast_utils_js_1.findNodes)(root, 'import_from_statement');
        for (const stmt of fromStmts) {
            const moduleName = this.extractModuleName(stmt, source);
            const isRelative = moduleName.startsWith('.');
            // Wildcard import
            if ((0, ast_utils_js_1.findNodes)(stmt, 'wildcard_import').length > 0) {
                relationships.push({
                    sourceSymbol: '__file__',
                    targetSymbol: `${moduleName}.*`,
                    kind: 'imports',
                    filePath,
                    line: stmt.startPosition.row + 1,
                    metadata: { wildcard: true, ...(isRelative && { relative: true }) },
                });
                continue;
            }
            // Named imports (aliased_import nodes)
            const importedNames = (0, ast_utils_js_1.findNodes)(stmt, 'aliased_import');
            if (importedNames.length > 0) {
                for (const imported of importedNames) {
                    const nameNode = imported.child(0);
                    if (!nameNode)
                        continue;
                    const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
                    const aliasNode = imported.childCount > 2 ? imported.child(2) : null;
                    const alias = aliasNode ? (0, ast_utils_js_1.getNodeText)(aliasNode, source) : undefined;
                    relationships.push({
                        sourceSymbol: '__file__',
                        targetSymbol: moduleName ? `${moduleName}.${name}` : name,
                        kind: 'imports',
                        filePath,
                        line: stmt.startPosition.row + 1,
                        metadata: {
                            from: moduleName,
                            name,
                            ...(alias && { alias }),
                            ...(isRelative && { relative: true }),
                        },
                    });
                }
            }
            else {
                // Simple identifiers after 'import' keyword
                const identifiers = this.getImportedIdentifiers(stmt, source);
                for (const name of identifiers) {
                    relationships.push({
                        sourceSymbol: '__file__',
                        targetSymbol: moduleName ? `${moduleName}.${name}` : name,
                        kind: 'imports',
                        filePath,
                        line: stmt.startPosition.row + 1,
                        metadata: { from: moduleName, name },
                    });
                }
            }
        }
    }
    extractModuleName(stmt, source) {
        for (let i = 0; i < stmt.childCount; i++) {
            const child = stmt.child(i);
            if (!child)
                continue;
            if (child.type === 'dotted_name' || child.type === 'relative_import') {
                return (0, ast_utils_js_1.getNodeText)(child, source);
            }
        }
        return '';
    }
    getImportedIdentifiers(stmt, source) {
        const names = [];
        let afterImport = false;
        for (let i = 0; i < stmt.childCount; i++) {
            const child = stmt.child(i);
            if (!child)
                continue;
            if (child.type === 'import') {
                afterImport = true;
                continue;
            }
            if (afterImport && (child.type === 'dotted_name' || child.type === 'identifier')) {
                names.push((0, ast_utils_js_1.getNodeText)(child, source));
            }
        }
        return names;
    }
    // ─── Declaration Extraction ──────────────────────────────────────────
    extractDeclarations(node, source, filePath, parentName, symbols, relationships) {
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (!child)
                continue;
            switch (child.type) {
                case 'function_definition':
                    this.extractFunction(child, source, filePath, parentName, symbols, relationships);
                    break;
                case 'class_definition':
                    this.extractClass(child, source, filePath, parentName, symbols, relationships);
                    break;
                case 'decorated_definition':
                    this.extractDecorated(child, source, filePath, parentName, symbols, relationships);
                    break;
                case 'expression_statement':
                    if (!parentName) {
                        this.extractModuleVariable(child, source, filePath, symbols);
                    }
                    break;
            }
        }
    }
    extractDecorated(node, source, filePath, parentName, symbols, relationships) {
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (!child)
                continue;
            if (child.type === 'function_definition') {
                this.extractFunction(child, source, filePath, parentName, symbols, relationships, node);
            }
            else if (child.type === 'class_definition') {
                this.extractClass(child, source, filePath, parentName, symbols, relationships, node);
            }
        }
    }
    // ─── Function Extraction ─────────────────────────────────────────────
    extractFunction(node, source, filePath, parentName, symbols, relationships, decoratedNode) {
        const nameNode = (0, ast_utils_js_1.getNamedChild)(node, 'identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const range = (0, ast_utils_js_1.getNodeRange)(decoratedNode || node);
        // Detect async — check preceding text for 'async' keyword
        const precedingText = source.substring(Math.max(0, node.startIndex - 6), node.startIndex);
        const isAsync = precedingText.includes('async');
        // Extract decorators
        const decorators = this.getDecorators(decoratedNode || node, source);
        // Determine kind
        let kind = parentName ? 'method' : 'function';
        if (decorators.includes('property'))
            kind = 'property';
        if (name === '__init__')
            kind = 'constructor';
        // Extract parameters
        const paramsNode = (0, ast_utils_js_1.getNamedChild)(node, 'parameters');
        const params = paramsNode ? (0, ast_utils_js_1.getNodeText)(paramsNode, source) : '()';
        // Extract return type
        const returnType = this.extractReturnType(node, source);
        // Modifiers
        const modifiers = [];
        if (isAsync)
            modifiers.push('async');
        if (decorators.includes('staticmethod'))
            modifiers.push('static');
        if (decorators.includes('classmethod'))
            modifiers.push('classmethod');
        if (decorators.includes('abstractmethod'))
            modifiers.push('abstract');
        const isExported = !name.startsWith('_');
        const body = (0, ast_utils_js_1.getNamedChild)(node, 'block');
        const complexity = body ? this.calculateComplexity(body) : 1;
        const docComment = body ? this.extractDocstring(body, source) : null;
        symbols.push({
            name,
            kind,
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: this.buildFunctionSignature(isAsync, name, params, returnType),
            parameters: params,
            returnType,
            modifiers,
            decorators,
            parentName,
            isAsync,
            isExported,
            docComment,
            complexity,
        });
        // Extract calls from body
        if (body) {
            this.extractCalls(body, source, filePath, parentName ? `${parentName}.${name}` : name, relationships);
        }
        // Extract nested definitions
        if (body) {
            this.extractDeclarations(body, source, filePath, name, symbols, relationships);
        }
        // Decorator relationships
        for (const dec of decorators) {
            relationships.push({
                sourceSymbol: parentName ? `${parentName}.${name}` : name,
                targetSymbol: dec,
                kind: 'decorates',
                filePath,
                line: range.startLine,
            });
        }
    }
    // ─── Class Extraction ────────────────────────────────────────────────
    extractClass(node, source, filePath, parentName, symbols, relationships, decoratedNode) {
        const nameNode = (0, ast_utils_js_1.getNamedChild)(node, 'identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const range = (0, ast_utils_js_1.getNodeRange)(decoratedNode || node);
        const decorators = this.getDecorators(decoratedNode || node, source);
        // Extract base classes
        const argList = (0, ast_utils_js_1.getNamedChild)(node, 'argument_list');
        const bases = [];
        let isProtocol = false;
        let isABC = false;
        if (argList) {
            for (let i = 0; i < argList.namedChildCount; i++) {
                const arg = argList.namedChild(i);
                if (!arg)
                    continue;
                if (arg.type === 'identifier' || arg.type === 'attribute') {
                    const baseName = (0, ast_utils_js_1.getNodeText)(arg, source);
                    bases.push(baseName);
                    if (baseName === 'Protocol')
                        isProtocol = true;
                    if (baseName === 'ABC' || baseName === 'ABCMeta')
                        isABC = true;
                    const relKind = isProtocol ? 'implements' : 'inherits';
                    relationships.push({
                        sourceSymbol: name,
                        targetSymbol: baseName,
                        kind: relKind,
                        filePath,
                        line: arg.startPosition.row + 1,
                    });
                }
            }
        }
        const kind = isProtocol ? 'interface' : 'class';
        const modifiers = [];
        if (isABC)
            modifiers.push('abstract');
        if (decorators.includes('dataclass'))
            modifiers.push('dataclass');
        const isExported = !name.startsWith('_');
        const body = (0, ast_utils_js_1.getNamedChild)(node, 'block');
        const docComment = body ? this.extractDocstring(body, source) : null;
        symbols.push({
            name,
            kind,
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: `class ${name}${bases.length ? `(${bases.join(', ')})` : ''}`,
            modifiers,
            decorators,
            parentName,
            isExported,
            docComment,
        });
        // Extract class body
        if (body) {
            this.extractDeclarations(body, source, filePath, name, symbols, relationships);
        }
        // Decorator relationships
        for (const dec of decorators) {
            relationships.push({
                sourceSymbol: name,
                targetSymbol: dec,
                kind: 'decorates',
                filePath,
                line: range.startLine,
            });
        }
    }
    // ─── Module Variable Extraction ──────────────────────────────────────
    extractModuleVariable(node, source, filePath, symbols) {
        const assignment = (0, ast_utils_js_1.getNamedChild)(node, 'assignment');
        if (!assignment)
            return;
        const left = assignment.child(0);
        if (!left || left.type !== 'identifier')
            return;
        const name = (0, ast_utils_js_1.getNodeText)(left, source);
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const isConstant = /^[A-Z_][A-Z0-9_]*$/.test(name);
        symbols.push({
            name,
            kind: isConstant ? 'constant' : 'variable',
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: (0, ast_utils_js_1.getNodeText)(node, source).split('\n')[0].trim().slice(0, 200),
            isExported: !name.startsWith('_'),
        });
    }
    // ─── Call Extraction ─────────────────────────────────────────────────
    extractCalls(body, source, filePath, callerName, relationships) {
        const callNodes = (0, ast_utils_js_1.findNodes)(body, 'call');
        const seen = new Set();
        for (const call of callNodes) {
            const funcNode = call.child(0);
            if (!funcNode)
                continue;
            const funcName = (0, ast_utils_js_1.getNodeText)(funcNode, source);
            // Skip common builtins
            if (['print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict',
                'set', 'tuple', 'type', 'isinstance', 'issubclass', 'super',
                'hasattr', 'getattr', 'setattr', 'repr', 'bool', 'enumerate',
                'zip', 'map', 'filter', 'sorted', 'reversed', 'any', 'all',
                'min', 'max', 'abs', 'round', 'open', 'id', 'hex', 'oct',
                'bin', 'ord', 'chr', 'format', 'vars', 'dir', 'help',
                'input', 'iter', 'next', 'slice', 'object', 'property',
                'staticmethod', 'classmethod'].includes(funcName))
                continue;
            const key = `${callerName}->${funcName}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            relationships.push({
                sourceSymbol: callerName,
                targetSymbol: funcName,
                kind: 'calls',
                filePath,
                line: call.startPosition.row + 1,
            });
        }
    }
    // ─── Helpers ─────────────────────────────────────────────────────────
    getDecorators(node, source) {
        const decorators = [];
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (!child || child.type !== 'decorator')
                continue;
            const text = (0, ast_utils_js_1.getNodeText)(child, source).replace(/^@/, '').split('(')[0].trim();
            decorators.push(text);
        }
        return decorators;
    }
    extractReturnType(node, source) {
        const typeNode = (0, ast_utils_js_1.getNamedChild)(node, 'type');
        if (typeNode)
            return (0, ast_utils_js_1.getNodeText)(typeNode, source);
        return undefined;
    }
    extractDocstring(body, source) {
        const firstChild = body.namedChild(0);
        if (!firstChild || firstChild.type !== 'expression_statement')
            return null;
        const expr = firstChild.namedChild(0);
        if (!expr || expr.type !== 'string')
            return null;
        const text = (0, ast_utils_js_1.getNodeText)(expr, source);
        return text
            .replace(/^("""|''')\s*/, '')
            .replace(/\s*("""|''')$/, '')
            .trim()
            .slice(0, 500) || null;
    }
    calculateComplexity(node) {
        let complexity = 1;
        const branchTypes = new Set([
            'if_statement', 'elif_clause', 'for_statement', 'while_statement',
            'except_clause', 'with_statement', 'case_clause', 'assert_statement',
        ]);
        (0, ast_utils_js_1.walkTree)(node, {
            enter(n) {
                if (branchTypes.has(n.type))
                    complexity++;
                if (n.type === 'boolean_operator')
                    complexity++;
                if (n.type === 'conditional_expression')
                    complexity++;
                if (['list_comprehension', 'set_comprehension',
                    'dictionary_comprehension', 'generator_expression'].includes(n.type)) {
                    complexity++;
                }
            }
        });
        return complexity;
    }
    buildFunctionSignature(isAsync, name, params, returnType) {
        const prefix = isAsync ? 'async ' : '';
        const ret = returnType ? ` -> ${returnType}` : '';
        return `${prefix}def ${name}${params}${ret}`.slice(0, 500);
    }
}
exports.default = PythonParser;
//# sourceMappingURL=python-parser.js.map