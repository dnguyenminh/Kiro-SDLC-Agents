"use strict";
/**
 * KSA-149: Java Language Parser.
 * Extracts symbols and relationships from Java AST using tree-sitter.
 * Supports: classes, interfaces, enums, records, annotations,
 * methods, constructors, fields, imports, inheritance, calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ast_utils_js_1 = require("../ast-utils.js");
class JavaParser {
    languageId;
    parser;
    constructor(parser, languageId) {
        this.parser = parser;
        this.languageId = languageId;
    }
    getSupportedExtensions() {
        return ['.java'];
    }
    parse(source, filePath) {
        const tree = this.parser.parse(source);
        const symbols = [];
        const relationships = [];
        const errors = [];
        if (tree.rootNode.hasError) {
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
        // Extract type declarations
        this.extractDeclarations(tree.rootNode, source, filePath, null, symbols, relationships);
        return { symbols, relationships, errors };
    }
    // ─── Package Extraction ──────────────────────────────────────────────
    extractPackage(root, source, filePath, symbols) {
        const pkgNodes = (0, ast_utils_js_1.findNodes)(root, 'package_declaration');
        if (pkgNodes.length === 0)
            return;
        const pkgNode = pkgNodes[0];
        const scopedId = (0, ast_utils_js_1.findNodes)(pkgNode, 'scoped_identifier')[0]
            ?? (0, ast_utils_js_1.findNodes)(pkgNode, 'identifier')[0];
        if (!scopedId)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(scopedId, source);
        const range = (0, ast_utils_js_1.getNodeRange)(pkgNode);
        symbols.push({
            name,
            kind: 'namespace',
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: `package ${name}`,
            isExported: true,
        });
    }
    // ─── Import Extraction ───────────────────────────────────────────────
    extractImports(root, source, filePath, relationships) {
        const importNodes = (0, ast_utils_js_1.findNodes)(root, 'import_declaration');
        for (const importNode of importNodes) {
            const text = (0, ast_utils_js_1.getNodeText)(importNode, source);
            const isStatic = text.includes('static');
            const isWildcard = text.includes('*');
            // Extract the import path
            const scopedId = (0, ast_utils_js_1.findNodes)(importNode, 'scoped_identifier')[0];
            const identifier = (0, ast_utils_js_1.findNodes)(importNode, 'identifier');
            const path = scopedId
                ? (0, ast_utils_js_1.getNodeText)(scopedId, source)
                : (identifier.length > 0 ? (0, ast_utils_js_1.getNodeText)(identifier[0], source) : '');
            const target = isWildcard ? `${path}.*` : path;
            relationships.push({
                sourceSymbol: '__file__',
                targetSymbol: target,
                kind: 'imports',
                filePath,
                line: importNode.startPosition.row + 1,
                metadata: {
                    ...(isStatic && { static: true }),
                    ...(isWildcard && { wildcard: true }),
                },
            });
        }
    }
    // ─── Declaration Extraction ──────────────────────────────────────────
    extractDeclarations(node, source, filePath, parentName, symbols, relationships, depth = 0) {
        if (depth > 10)
            return; // Safety: prevent infinite recursion
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (!child)
                continue;
            switch (child.type) {
                case 'class_declaration':
                    this.extractType(child, source, filePath, parentName, 'class', symbols, relationships, depth);
                    break;
                case 'interface_declaration':
                    this.extractType(child, source, filePath, parentName, 'interface', symbols, relationships, depth);
                    break;
                case 'enum_declaration':
                    this.extractType(child, source, filePath, parentName, 'enum', symbols, relationships, depth);
                    break;
                case 'record_declaration':
                    this.extractType(child, source, filePath, parentName, 'class', symbols, relationships, depth);
                    break;
                case 'annotation_type_declaration':
                    this.extractType(child, source, filePath, parentName, 'interface', symbols, relationships, depth);
                    break;
            }
        }
    }
    // ─── Type (Class/Interface/Enum/Record) Extraction ───────────────────
    extractType(node, source, filePath, parentName, defaultKind, symbols, relationships, depth) {
        const nameNode = (0, ast_utils_js_1.getNamedChild)(node, 'identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const docComment = (0, ast_utils_js_1.extractDocComment)(node, source);
        // Modifiers
        const modifiers = this.extractModifiers(node, source);
        const isExported = modifiers.includes('public');
        // Annotations
        const annotations = this.extractAnnotations(node, source);
        // Determine kind
        const kind = defaultKind;
        if (node.type === 'record_declaration') {
            modifiers.push('record');
        }
        if (node.type === 'annotation_type_declaration') {
            modifiers.push('annotation');
        }
        // Extract superclass and interfaces
        this.extractInheritance(node, source, filePath, name, relationships);
        // Build signature
        const typeKeyword = node.type === 'record_declaration' ? 'record'
            : node.type === 'annotation_type_declaration' ? '@interface'
                : defaultKind;
        const modStr = modifiers.filter(m => m !== 'record' && m !== 'annotation').join(' ');
        const signature = `${modStr} ${typeKeyword} ${name}`.trim();
        symbols.push({
            name,
            kind,
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: signature.slice(0, 500),
            modifiers,
            decorators: annotations,
            parentName,
            isExported,
            docComment,
        });
        // Extract body members
        const body = (0, ast_utils_js_1.getNamedChild)(node, 'class_body')
            ?? (0, ast_utils_js_1.getNamedChild)(node, 'interface_body')
            ?? (0, ast_utils_js_1.getNamedChild)(node, 'enum_body');
        if (body) {
            this.extractMembers(body, source, filePath, name, symbols, relationships, depth);
        }
        // Annotation relationships
        for (const ann of annotations) {
            relationships.push({
                sourceSymbol: name,
                targetSymbol: ann,
                kind: 'decorates',
                filePath,
                line: range.startLine,
            });
        }
    }
    // ─── Member Extraction ───────────────────────────────────────────────
    extractMembers(body, source, filePath, className, symbols, relationships, depth) {
        for (let i = 0; i < body.namedChildCount; i++) {
            const member = body.namedChild(i);
            if (!member)
                continue;
            switch (member.type) {
                case 'method_declaration':
                    this.extractMethod(member, source, filePath, className, symbols, relationships);
                    break;
                case 'constructor_declaration':
                    this.extractConstructor(member, source, filePath, className, symbols, relationships);
                    break;
                case 'field_declaration':
                    this.extractFields(member, source, filePath, className, symbols);
                    break;
                case 'class_declaration':
                    this.extractType(member, source, filePath, className, 'class', symbols, relationships, depth + 1);
                    break;
                case 'interface_declaration':
                    this.extractType(member, source, filePath, className, 'interface', symbols, relationships, depth + 1);
                    break;
                case 'enum_declaration':
                    this.extractType(member, source, filePath, className, 'enum', symbols, relationships, depth + 1);
                    break;
                case 'record_declaration':
                    this.extractType(member, source, filePath, className, 'class', symbols, relationships, depth + 1);
                    break;
            }
        }
    }
    // ─── Method Extraction ───────────────────────────────────────────────
    extractMethod(node, source, filePath, className, symbols, relationships) {
        const nameNode = (0, ast_utils_js_1.getNamedChild)(node, 'identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const modifiers = this.extractModifiers(node, source);
        const annotations = this.extractAnnotations(node, source);
        const docComment = (0, ast_utils_js_1.extractDocComment)(node, source);
        // Parameters
        const paramsNode = (0, ast_utils_js_1.getNamedChild)(node, 'formal_parameters');
        const params = paramsNode ? (0, ast_utils_js_1.getNodeText)(paramsNode, source) : '()';
        // Return type
        const returnType = this.extractMethodReturnType(node, source);
        // Complexity
        const body = (0, ast_utils_js_1.getNamedChild)(node, 'block');
        const complexity = body ? this.calculateComplexity(body) : 1;
        symbols.push({
            name,
            kind: 'method',
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: this.buildMethodSignature(modifiers, returnType, name, params),
            parameters: params,
            returnType,
            modifiers,
            decorators: annotations,
            parentName: className,
            isExported: modifiers.includes('public'),
            docComment,
            complexity,
        });
        // Extract calls
        if (body) {
            this.extractCalls(body, source, filePath, `${className}.${name}`, relationships);
        }
        // Annotation relationships
        for (const ann of annotations) {
            relationships.push({
                sourceSymbol: `${className}.${name}`,
                targetSymbol: ann,
                kind: 'decorates',
                filePath,
                line: range.startLine,
            });
        }
    }
    // ─── Constructor Extraction ──────────────────────────────────────────
    extractConstructor(node, source, filePath, className, symbols, relationships) {
        const nameNode = (0, ast_utils_js_1.getNamedChild)(node, 'identifier');
        const name = nameNode ? (0, ast_utils_js_1.getNodeText)(nameNode, source) : className;
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const modifiers = this.extractModifiers(node, source);
        const annotations = this.extractAnnotations(node, source);
        const docComment = (0, ast_utils_js_1.extractDocComment)(node, source);
        const paramsNode = (0, ast_utils_js_1.getNamedChild)(node, 'formal_parameters');
        const params = paramsNode ? (0, ast_utils_js_1.getNodeText)(paramsNode, source) : '()';
        const body = (0, ast_utils_js_1.getNamedChild)(node, 'constructor_body') ?? (0, ast_utils_js_1.getNamedChild)(node, 'block');
        const complexity = body ? this.calculateComplexity(body) : 1;
        symbols.push({
            name: 'constructor',
            kind: 'constructor',
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: `${modifiers.join(' ')} ${name}${params}`.trim(),
            parameters: params,
            modifiers,
            decorators: annotations,
            parentName: className,
            isExported: modifiers.includes('public'),
            docComment,
            complexity,
        });
        // Extract calls
        if (body) {
            this.extractCalls(body, source, filePath, `${className}.constructor`, relationships);
        }
    }
    // ─── Field Extraction ────────────────────────────────────────────────
    extractFields(node, source, filePath, className, symbols) {
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const modifiers = this.extractModifiers(node, source);
        const annotations = this.extractAnnotations(node, source);
        // Get type
        const typeText = this.getFieldType(node, source);
        // Get declarators (variable names)
        const declarators = (0, ast_utils_js_1.findNodes)(node, 'variable_declarator');
        for (const decl of declarators) {
            const nameNode = (0, ast_utils_js_1.getNamedChild)(decl, 'identifier');
            if (!nameNode)
                continue;
            const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
            const isConstant = modifiers.includes('static') && modifiers.includes('final')
                && /^[A-Z_][A-Z0-9_]*$/.test(name);
            symbols.push({
                name,
                kind: isConstant ? 'constant' : 'property',
                filePath,
                startLine: range.startLine,
                endLine: range.endLine,
                signature: `${modifiers.join(' ')} ${typeText} ${name}`.trim().slice(0, 200),
                returnType: typeText,
                modifiers,
                decorators: annotations,
                parentName: className,
                isExported: modifiers.includes('public'),
            });
        }
    }
    // ─── Inheritance Extraction ──────────────────────────────────────────
    extractInheritance(node, source, filePath, className, relationships) {
        // extends (superclass)
        const superclass = (0, ast_utils_js_1.getNamedChild)(node, 'superclass');
        if (superclass) {
            const typeId = (0, ast_utils_js_1.getNamedChild)(superclass, 'type_identifier')
                ?? (0, ast_utils_js_1.getNamedChild)(superclass, 'scoped_type_identifier')
                ?? (0, ast_utils_js_1.getNamedChild)(superclass, 'generic_type');
            if (typeId) {
                const baseName = this.getBaseTypeName(typeId, source);
                relationships.push({
                    sourceSymbol: className,
                    targetSymbol: baseName,
                    kind: 'inherits',
                    filePath,
                    line: typeId.startPosition.row + 1,
                });
            }
        }
        // implements (interfaces)
        const interfaces = (0, ast_utils_js_1.getNamedChild)(node, 'super_interfaces');
        if (interfaces) {
            const typeList = (0, ast_utils_js_1.getNamedChild)(interfaces, 'type_list');
            if (typeList) {
                for (let i = 0; i < typeList.namedChildCount; i++) {
                    const typeNode = typeList.namedChild(i);
                    if (!typeNode)
                        continue;
                    const ifaceName = this.getBaseTypeName(typeNode, source);
                    relationships.push({
                        sourceSymbol: className,
                        targetSymbol: ifaceName,
                        kind: 'implements',
                        filePath,
                        line: typeNode.startPosition.row + 1,
                    });
                }
            }
        }
        // extends for interfaces (multiple inheritance)
        const extendsInterfaces = (0, ast_utils_js_1.getNamedChild)(node, 'extends_interfaces');
        if (extendsInterfaces) {
            const typeList = (0, ast_utils_js_1.getNamedChild)(extendsInterfaces, 'type_list');
            if (typeList) {
                for (let i = 0; i < typeList.namedChildCount; i++) {
                    const typeNode = typeList.namedChild(i);
                    if (!typeNode)
                        continue;
                    const ifaceName = this.getBaseTypeName(typeNode, source);
                    relationships.push({
                        sourceSymbol: className,
                        targetSymbol: ifaceName,
                        kind: 'inherits',
                        filePath,
                        line: typeNode.startPosition.row + 1,
                    });
                }
            }
        }
    }
    // ─── Call Extraction ─────────────────────────────────────────────────
    extractCalls(body, source, filePath, callerName, relationships) {
        const seen = new Set();
        // Method invocations
        const methodCalls = (0, ast_utils_js_1.findNodes)(body, 'method_invocation');
        for (const call of methodCalls) {
            const target = this.resolveCallTarget(call, source);
            if (!target)
                continue;
            const key = `${callerName}->${target}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            relationships.push({
                sourceSymbol: callerName,
                targetSymbol: target,
                kind: 'calls',
                filePath,
                line: call.startPosition.row + 1,
            });
        }
        // Object creation (new X())
        const creations = (0, ast_utils_js_1.findNodes)(body, 'object_creation_expression');
        for (const creation of creations) {
            const typeNode = (0, ast_utils_js_1.getNamedChild)(creation, 'type_identifier')
                ?? (0, ast_utils_js_1.getNamedChild)(creation, 'scoped_type_identifier')
                ?? (0, ast_utils_js_1.getNamedChild)(creation, 'generic_type');
            if (!typeNode)
                continue;
            const typeName = this.getBaseTypeName(typeNode, source);
            const target = `${typeName}.constructor`;
            const key = `${callerName}->${target}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            relationships.push({
                sourceSymbol: callerName,
                targetSymbol: target,
                kind: 'calls',
                filePath,
                line: creation.startPosition.row + 1,
                metadata: { constructor: true },
            });
        }
    }
    resolveCallTarget(callNode, source) {
        const nameNode = (0, ast_utils_js_1.getNamedChild)(callNode, 'identifier');
        if (!nameNode)
            return null;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        // Check for object (receiver) — first child before the dot
        const object = callNode.child(0);
        if (object && object !== nameNode && object.type !== 'identifier') {
            const objectText = (0, ast_utils_js_1.getNodeText)(object, source);
            // Simplify long chains
            const simplified = objectText.length > 50
                ? objectText.split('.').slice(-2).join('.')
                : objectText;
            return `${simplified}.${name}`;
        }
        // Simple method call or same-class call with identifier receiver
        if (object && object !== nameNode && object.type === 'identifier') {
            return `${(0, ast_utils_js_1.getNodeText)(object, source)}.${name}`;
        }
        return name;
    }
    // ─── Helpers ─────────────────────────────────────────────────────────
    extractModifiers(node, source) {
        const modifiers = [];
        const modifierNode = (0, ast_utils_js_1.getNamedChild)(node, 'modifiers');
        if (modifierNode) {
            for (let i = 0; i < modifierNode.childCount; i++) {
                const child = modifierNode.child(i);
                if (!child)
                    continue;
                if (child.type !== 'marker_annotation' && child.type !== 'annotation') {
                    const text = (0, ast_utils_js_1.getNodeText)(child, source);
                    if (['public', 'private', 'protected', 'static', 'final',
                        'abstract', 'synchronized', 'native', 'transient',
                        'volatile', 'default', 'sealed', 'non-sealed'].includes(text)) {
                        modifiers.push(text);
                    }
                }
            }
        }
        return modifiers;
    }
    extractAnnotations(node, source) {
        const annotations = [];
        const modifierNode = (0, ast_utils_js_1.getNamedChild)(node, 'modifiers');
        if (modifierNode) {
            for (let i = 0; i < modifierNode.childCount; i++) {
                const child = modifierNode.child(i);
                if (!child)
                    continue;
                if (child.type === 'marker_annotation' || child.type === 'annotation') {
                    const text = (0, ast_utils_js_1.getNodeText)(child, source).replace(/^@/, '').split('(')[0].trim();
                    annotations.push(text);
                }
            }
        }
        return annotations;
    }
    extractMethodReturnType(node, source) {
        // In Java, return type is a direct child before the method name
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (!child)
                continue;
            if (['type_identifier', 'void_type', 'integral_type', 'floating_point_type',
                'boolean_type', 'generic_type', 'scoped_type_identifier', 'array_type'].includes(child.type)) {
                return (0, ast_utils_js_1.getNodeText)(child, source);
            }
        }
        return undefined;
    }
    getFieldType(node, source) {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (!child)
                continue;
            if (['type_identifier', 'void_type', 'integral_type', 'floating_point_type',
                'boolean_type', 'generic_type', 'scoped_type_identifier', 'array_type'].includes(child.type)) {
                return (0, ast_utils_js_1.getNodeText)(child, source);
            }
        }
        return '';
    }
    getBaseTypeName(typeNode, source) {
        // Strip generics: List<String> -> List
        const text = (0, ast_utils_js_1.getNodeText)(typeNode, source);
        return text.split('<')[0].trim();
    }
    calculateComplexity(node) {
        let complexity = 1;
        const branchTypes = new Set([
            'if_statement', 'for_statement', 'enhanced_for_statement',
            'while_statement', 'do_statement', 'switch_expression',
            'catch_clause', 'ternary_expression', 'switch_block_statement_group',
        ]);
        (0, ast_utils_js_1.walkTree)(node, {
            enter(n) {
                if (branchTypes.has(n.type))
                    complexity++;
                if (n.type === '&&' || n.type === '||')
                    complexity++;
                if (n.type === 'lambda_expression')
                    complexity++;
            }
        });
        return complexity;
    }
    buildMethodSignature(modifiers, returnType, name, params) {
        const mods = modifiers.length ? modifiers.join(' ') + ' ' : '';
        const ret = returnType ? returnType + ' ' : '';
        return `${mods}${ret}${name}${params}`.trim().slice(0, 500);
    }
}
exports.default = JavaParser;
//# sourceMappingURL=java-parser.js.map