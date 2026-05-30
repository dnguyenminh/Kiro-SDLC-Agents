"use strict";
/**
 * KSA-147: Kotlin Language Parser.
 * Extracts symbols and relationships from Kotlin AST using tree-sitter.
 * Handles: classes, data classes, sealed classes, objects, companion objects,
 * functions, extension functions, suspend functions, properties, type aliases,
 * imports, inheritance, and call relationships.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ast_utils_js_1 = require("../ast-utils.js");
class KotlinParser {
    languageId = 'kotlin';
    parser; // web-tree-sitter Parser instance
    constructor(parser, _languageId) {
        this.parser = parser;
    }
    getSupportedExtensions() {
        return ['.kt', '.kts'];
    }
    parse(source, filePath) {
        const tree = this.parser.parse(source);
        const symbols = [];
        const relationships = [];
        const errors = [];
        // Collect parse errors
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
        // Extract package declaration
        this.extractPackage(tree.rootNode, source, filePath, symbols);
        // Extract imports
        this.extractImports(tree.rootNode, source, filePath, relationships);
        // Extract top-level declarations
        this.extractDeclarations(tree.rootNode, source, filePath, symbols, relationships, undefined);
        return { symbols, relationships, errors };
    }
    // ─── Package ───────────────────────────────────────────────────────────────
    extractPackage(root, source, filePath, symbols) {
        const pkgNode = (0, ast_utils_js_1.findFirst)(root, 'package_header');
        if (!pkgNode)
            return;
        const identifier = (0, ast_utils_js_1.findFirst)(pkgNode, 'identifier');
        if (!identifier)
            return;
        symbols.push({
            name: (0, ast_utils_js_1.getNodeText)(identifier, source),
            kind: 'namespace',
            filePath,
            ...(0, ast_utils_js_1.getNodeRange)(pkgNode),
            signature: (0, ast_utils_js_1.getNodeText)(pkgNode, source).trim(),
        });
    }
    // ─── Imports ───────────────────────────────────────────────────────────────
    extractImports(root, source, filePath, relationships) {
        const imports = (0, ast_utils_js_1.findNodes)(root, 'import_header');
        for (const imp of imports) {
            const identifier = (0, ast_utils_js_1.findFirst)(imp, 'identifier');
            if (!identifier)
                continue;
            const target = (0, ast_utils_js_1.getNodeText)(identifier, source);
            const impText = (0, ast_utils_js_1.getNodeText)(imp, source);
            const isWildcard = impText.includes('.*') || impText.endsWith('*');
            // Check for alias: import ... as Alias
            let alias;
            const aliasNode = (0, ast_utils_js_1.findFirst)(imp, 'import_alias');
            if (aliasNode) {
                const aliasId = (0, ast_utils_js_1.findFirst)(aliasNode, 'simple_identifier');
                if (aliasId)
                    alias = (0, ast_utils_js_1.getNodeText)(aliasId, source);
            }
            relationships.push({
                sourceSymbol: '__file__',
                targetSymbol: isWildcard ? target + '.*' : target,
                kind: 'imports',
                filePath,
                line: imp.startPosition.row + 1,
                metadata: {
                    ...(isWildcard && { wildcard: true }),
                    ...(alias && { alias }),
                },
            });
        }
    }
    // ─── Declarations ──────────────────────────────────────────────────────────
    extractDeclarations(node, source, filePath, symbols, relationships, parentName) {
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (!child)
                continue;
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
    // ─── Class ─────────────────────────────────────────────────────────────────
    extractClass(node, source, filePath, symbols, relationships, parentName) {
        const nameNode = (0, ast_utils_js_1.findFirst)(node, 'type_identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const modifiers = this.extractModifiers(node, source);
        const annotations = this.getAnnotationNames(node, source);
        // Determine kind
        const nodeText = (0, ast_utils_js_1.getNodeText)(node, source).split('{')[0];
        const isInterface = nodeText.match(/\binterface\b/) !== null;
        const isEnum = modifiers.includes('enum');
        const isData = modifiers.includes('data');
        const kind = isInterface ? 'interface' : isEnum ? 'enum' : 'class';
        // Extract type parameters
        const typeParams = this.extractTypeParameters(node, source);
        // Extract primary constructor parameters
        const params = this.extractPrimaryConstructor(node, source);
        // Extract supertypes (extends/implements)
        const delegationSpecs = (0, ast_utils_js_1.findFirst)(node, 'delegation_specifiers');
        if (delegationSpecs) {
            this.extractSupertypes(delegationSpecs, source, name, filePath, relationships);
        }
        // Build signature
        const modPrefix = modifiers.filter(m => !['public', 'internal'].includes(m)).join(' ');
        const kindStr = isInterface ? 'interface' : 'class';
        const sig = `${modPrefix ? modPrefix + ' ' : ''}${kindStr} ${name}${typeParams}${params ? `(${params})` : ''}`;
        symbols.push({
            name,
            kind,
            filePath,
            ...(0, ast_utils_js_1.getNodeRange)(node),
            signature: sig.trim().slice(0, 500),
            parameters: params || undefined,
            modifiers: modifiers.length > 0 ? modifiers : undefined,
            parentName: parentName ?? null,
            isExported: !modifiers.includes('private'),
            decorators: annotations.length > 0 ? annotations : undefined,
        });
        // Extract class body members
        const classBody = (0, ast_utils_js_1.findFirst)(node, 'class_body');
        if (classBody) {
            this.extractDeclarations(classBody, source, filePath, symbols, relationships, name);
            // Extract companion objects
            this.extractCompanionObjects(classBody, source, filePath, symbols, relationships, name);
        }
        // Generate implicit members for data classes
        if (isData && params) {
            this.generateDataClassMembers(name, filePath, node, symbols);
        }
    }
    // ─── Object ────────────────────────────────────────────────────────────────
    extractObject(node, source, filePath, symbols, relationships, parentName) {
        const nameNode = (0, ast_utils_js_1.findFirst)(node, 'type_identifier') ?? (0, ast_utils_js_1.findFirst)(node, 'simple_identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const modifiers = this.extractModifiers(node, source);
        // Extract supertypes
        const delegationSpecs = (0, ast_utils_js_1.findFirst)(node, 'delegation_specifiers');
        if (delegationSpecs) {
            this.extractSupertypes(delegationSpecs, source, name, filePath, relationships);
        }
        symbols.push({
            name,
            kind: 'class',
            filePath,
            ...(0, ast_utils_js_1.getNodeRange)(node),
            signature: `object ${name}`,
            modifiers: [...modifiers, 'object'],
            parentName: parentName ?? null,
            isExported: !modifiers.includes('private'),
        });
        // Extract object body members
        const classBody = (0, ast_utils_js_1.findFirst)(node, 'class_body');
        if (classBody) {
            this.extractDeclarations(classBody, source, filePath, symbols, relationships, name);
        }
    }
    // ─── Companion Object ──────────────────────────────────────────────────────
    extractCompanionObjects(classBody, source, filePath, symbols, relationships, className) {
        const companions = (0, ast_utils_js_1.findNodes)(classBody, 'companion_object');
        for (const comp of companions) {
            const companionName = `${className}.Companion`;
            symbols.push({
                name: 'Companion',
                kind: 'class',
                filePath,
                ...(0, ast_utils_js_1.getNodeRange)(comp),
                signature: `companion object`,
                modifiers: ['companion', 'object'],
                parentName: className,
            });
            // Extract companion body members
            const body = (0, ast_utils_js_1.findFirst)(comp, 'class_body');
            if (body) {
                this.extractDeclarations(body, source, filePath, symbols, relationships, companionName);
            }
        }
    }
    // ─── Function ──────────────────────────────────────────────────────────────
    extractFunction(node, source, filePath, symbols, relationships, parentName) {
        const nameNode = (0, ast_utils_js_1.findFirst)(node, 'simple_identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const modifiers = this.extractModifiers(node, source);
        const isSuspend = modifiers.includes('suspend');
        const annotations = this.getAnnotationNames(node, source);
        // Check for receiver type (extension function)
        const receiverType = this.extractReceiverType(node, source);
        // Extract parameters
        const params = this.extractFunctionParameters(node, source);
        // Extract return type
        const returnType = this.extractReturnType(node, source);
        // Calculate complexity
        const body = (0, ast_utils_js_1.findFirst)(node, 'function_body');
        const complexity = body ? this.calculateKotlinComplexity(body) : 1;
        const kind = parentName ? 'method' : 'function';
        // Build signature
        const sig = this.buildFunctionSignature(modifiers, receiverType, name, params, returnType);
        symbols.push({
            name,
            kind,
            filePath,
            ...(0, ast_utils_js_1.getNodeRange)(node),
            signature: sig,
            parameters: params || undefined,
            returnType: returnType ?? undefined,
            modifiers: receiverType ? [...modifiers, 'extension'] : (modifiers.length > 0 ? modifiers : undefined),
            parentName: parentName ?? null,
            isAsync: isSuspend,
            isExported: !modifiers.includes('private'),
            complexity,
            decorators: annotations.length > 0 ? annotations : undefined,
        });
        // Extract call relationships from function body
        if (body) {
            const callerName = parentName ? `${parentName}.${name}` : name;
            this.extractCalls(body, source, callerName, filePath, relationships);
        }
    }
    // ─── Property ──────────────────────────────────────────────────────────────
    extractProperty(node, source, filePath, symbols, relationships, parentName) {
        // Find variable declaration within property
        const varDecl = (0, ast_utils_js_1.findFirst)(node, 'variable_declaration');
        if (!varDecl)
            return;
        const nameNode = (0, ast_utils_js_1.findFirst)(varDecl, 'simple_identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const modifiers = this.extractModifiers(node, source);
        const annotations = this.getAnnotationNames(node, source);
        // Determine if val or var
        const nodeText = (0, ast_utils_js_1.getNodeText)(node, source);
        const isVal = nodeText.trimStart().startsWith('val ') || nodeText.match(/\bval\b/) !== null;
        const isConst = modifiers.includes('const');
        // Extract type
        const typeNode = (0, ast_utils_js_1.findFirst)(varDecl, 'user_type') ?? (0, ast_utils_js_1.findFirst)(varDecl, 'nullable_type');
        const type = typeNode ? (0, ast_utils_js_1.getNodeText)(typeNode, source) : undefined;
        const kind = isConst ? 'constant' : 'property';
        const sig = `${isVal ? 'val' : 'var'} ${name}${type ? ': ' + type : ''}`;
        symbols.push({
            name,
            kind,
            filePath,
            ...(0, ast_utils_js_1.getNodeRange)(node),
            signature: sig.slice(0, 200),
            returnType: type ?? undefined,
            modifiers: modifiers.length > 0 ? modifiers : undefined,
            parentName: parentName ?? null,
            isExported: !modifiers.includes('private'),
            decorators: annotations.length > 0 ? annotations : undefined,
        });
    }
    // ─── Type Alias ────────────────────────────────────────────────────────────
    extractTypeAlias(node, source, filePath, symbols, parentName) {
        const nameNode = (0, ast_utils_js_1.findFirst)(node, 'type_identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        symbols.push({
            name,
            kind: 'type',
            filePath,
            ...(0, ast_utils_js_1.getNodeRange)(node),
            signature: (0, ast_utils_js_1.getNodeText)(node, source).split('\n')[0].trim().slice(0, 200),
            parentName: parentName ?? null,
            isExported: true,
        });
    }
    // ─── Supertypes ────────────────────────────────────────────────────────────
    extractSupertypes(node, source, className, filePath, relationships) {
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (!child)
                continue;
            if (child.type === 'delegation_specifier' || child.type === 'annotated_delegation_specifier') {
                const specNode = child.type === 'annotated_delegation_specifier'
                    ? (0, ast_utils_js_1.findFirst)(child, 'delegation_specifier') ?? child
                    : child;
                const text = (0, ast_utils_js_1.getNodeText)(specNode, source).trim();
                const hasParens = text.includes('(');
                const typeName = text.replace(/\(.*\)$/, '').replace(/<.*>/, '').trim();
                if (typeName) {
                    relationships.push({
                        sourceSymbol: className,
                        targetSymbol: typeName,
                        kind: hasParens ? 'inherits' : 'implements',
                        filePath,
                        line: child.startPosition.row + 1,
                    });
                }
            }
        }
    }
    // ─── Call Extraction ───────────────────────────────────────────────────────
    extractCalls(node, source, sourceName, filePath, relationships) {
        const callExprs = (0, ast_utils_js_1.findNodes)(node, 'call_expression');
        const seen = new Set();
        for (const call of callExprs) {
            const target = this.resolveCallTarget(call, source);
            if (!target)
                continue;
            // Skip common noise
            if (target.name === 'println' || target.name === 'print')
                continue;
            const key = `${sourceName}->${target.name}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            relationships.push({
                sourceSymbol: sourceName,
                targetSymbol: target.name,
                kind: 'calls',
                filePath,
                line: call.startPosition.row + 1,
                metadata: target.metadata,
            });
        }
    }
    resolveCallTarget(node, source) {
        const firstChild = node.child(0);
        if (!firstChild)
            return null;
        if (firstChild.type === 'navigation_expression') {
            const text = (0, ast_utils_js_1.getNodeText)(firstChild, source);
            const parts = text.split('.');
            const method = parts[parts.length - 1];
            const receiver = parts.slice(0, -1).join('.');
            return { name: method, metadata: { receiver } };
        }
        if (firstChild.type === 'simple_identifier') {
            const name = (0, ast_utils_js_1.getNodeText)(firstChild, source);
            // Check if constructor call (starts with uppercase)
            if (name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase()) {
                return { name, metadata: { isConstructor: true } };
            }
            return { name };
        }
        return null;
    }
    // ─── Helpers ───────────────────────────────────────────────────────────────
    extractModifiers(node, source) {
        const modifiers = [];
        const modifierList = (0, ast_utils_js_1.findFirst)(node, 'modifiers');
        if (!modifierList)
            return modifiers;
        // Only process direct child modifiers
        if (modifierList.parent !== node)
            return modifiers;
        for (let i = 0; i < modifierList.namedChildCount; i++) {
            const child = modifierList.namedChild(i);
            if (!child)
                continue;
            // Skip annotations
            if (child.type === 'annotation')
                continue;
            const text = (0, ast_utils_js_1.getNodeText)(child, source).trim();
            if (text && !text.startsWith('@')) {
                modifiers.push(text);
            }
        }
        return modifiers;
    }
    getAnnotationNames(node, source) {
        const annotations = [];
        const modifierList = (0, ast_utils_js_1.findFirst)(node, 'modifiers');
        if (!modifierList || modifierList.parent !== node)
            return annotations;
        for (let i = 0; i < modifierList.namedChildCount; i++) {
            const child = modifierList.namedChild(i);
            if (!child || child.type !== 'annotation')
                continue;
            const text = (0, ast_utils_js_1.getNodeText)(child, source).replace(/^@/, '').split('(')[0].trim();
            if (text)
                annotations.push(text);
        }
        return annotations;
    }
    extractTypeParameters(node, source) {
        const typeParams = (0, ast_utils_js_1.findFirst)(node, 'type_parameters');
        if (!typeParams)
            return '';
        return (0, ast_utils_js_1.getNodeText)(typeParams, source);
    }
    extractPrimaryConstructor(node, source) {
        const constructor = (0, ast_utils_js_1.findFirst)(node, 'primary_constructor');
        if (!constructor)
            return null;
        const paramList = (0, ast_utils_js_1.findFirst)(constructor, 'class_parameters');
        if (!paramList)
            return null;
        return (0, ast_utils_js_1.getNodeText)(paramList, source).replace(/^\(|\)$/g, '');
    }
    extractFunctionParameters(node, source) {
        const params = (0, ast_utils_js_1.findFirst)(node, 'function_value_parameters');
        if (!params)
            return null;
        return (0, ast_utils_js_1.getNodeText)(params, source);
    }
    extractReturnType(node, source) {
        const nodeText = (0, ast_utils_js_1.getNodeText)(node, source);
        const headerEnd = nodeText.indexOf('{');
        const header = headerEnd > 0 ? nodeText.substring(0, headerEnd) : nodeText.split('\n')[0];
        // Find the last ':' that's not inside parentheses
        let depth = 0;
        let lastColon = -1;
        for (let i = header.length - 1; i >= 0; i--) {
            if (header[i] === ')')
                depth++;
            if (header[i] === '(')
                depth--;
            if (header[i] === ':' && depth === 0) {
                lastColon = i;
                break;
            }
        }
        if (lastColon > 0) {
            const returnType = header.substring(lastColon + 1).trim();
            if (returnType && !returnType.includes('(') && returnType !== '') {
                return returnType;
            }
        }
        return null;
    }
    extractReceiverType(node, source) {
        const nodeText = (0, ast_utils_js_1.getNodeText)(node, source);
        const funMatch = nodeText.match(/\bfun\s+(?:<[^>]+>\s+)?(\w+(?:<[^>]+>)?)\./);
        if (funMatch) {
            return funMatch[1];
        }
        return undefined;
    }
    calculateKotlinComplexity(node) {
        let complexity = 1;
        const branchTypes = new Set([
            'if_expression', 'when_entry', 'for_statement',
            'while_statement', 'do_while_statement', 'catch_block',
        ]);
        const logicalTypes = new Set(['conjunction_expression', 'disjunction_expression']);
        (0, ast_utils_js_1.walkTree)(node, {
            enter(n) {
                if (branchTypes.has(n.type))
                    complexity++;
                if (logicalTypes.has(n.type))
                    complexity++;
            }
        });
        return complexity;
    }
    buildFunctionSignature(modifiers, receiverType, name, params, returnType) {
        const modStr = modifiers.filter(m => !['public', 'internal'].includes(m)).join(' ');
        const receiver = receiverType ? `${receiverType}.` : '';
        const ret = returnType ? `: ${returnType}` : '';
        return `${modStr ? modStr + ' ' : ''}fun ${receiver}${name}${params ?? '()'}${ret}`.trim().slice(0, 500);
    }
    generateDataClassMembers(className, filePath, node, symbols) {
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const implicitMethods = ['copy', 'toString', 'hashCode', 'equals', 'componentN'];
        for (const method of implicitMethods) {
            symbols.push({
                name: method,
                kind: 'method',
                filePath,
                startLine: range.startLine,
                endLine: range.startLine,
                signature: `fun ${method}(): /* generated */`,
                parentName: className,
                modifiers: ['generated'],
            });
        }
    }
}
exports.default = KotlinParser;
//# sourceMappingURL=kotlin-parser.js.map