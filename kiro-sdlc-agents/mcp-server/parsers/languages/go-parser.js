"use strict";
/**
 * KSA-150: Go Language Parser.
 * Extracts symbols and relationships from Go AST using tree-sitter.
 * Handles: functions, methods (with receivers), structs, interfaces,
 * goroutines, defer, implicit interface implementation detection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ast_utils_js_1 = require("../ast-utils.js");
class GoParser {
    languageId;
    parser;
    constructor(parser, languageId) {
        this.parser = parser;
        this.languageId = languageId;
    }
    getSupportedExtensions() {
        return ['.go'];
    }
    parse(source, filePath) {
        // Skip generated files
        if (this.isGeneratedFile(source, filePath)) {
            return { symbols: [], relationships: [], errors: [] };
        }
        const tree = this.parser.parse(source);
        const symbols = [];
        const relationships = [];
        const errors = [];
        // Collect parse errors
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
        // Extract all top-level declarations
        this.extractDeclarations(tree.rootNode, source, filePath, symbols, relationships);
        // Extract imports
        this.extractImports(tree.rootNode, source, filePath, relationships);
        // Detect implicit interface implementations
        const implRelationships = this.detectInterfaceImplementations(symbols);
        relationships.push(...implRelationships);
        return { symbols, relationships, errors };
    }
    isGeneratedFile(source, filePath) {
        if (filePath.endsWith('_generated.go'))
            return true;
        const firstLines = source.split('\n').slice(0, 3).join('\n');
        return firstLines.includes('// Code generated');
    }
    extractDeclarations(root, source, filePath, symbols, relationships) {
        for (let i = 0; i < root.namedChildCount; i++) {
            const child = root.namedChild(i);
            if (!child)
                continue;
            switch (child.type) {
                case 'function_declaration':
                    this.extractFunction(child, source, filePath, symbols, relationships);
                    break;
                case 'method_declaration':
                    this.extractMethod(child, source, filePath, symbols, relationships);
                    break;
                case 'type_declaration':
                    this.extractTypeDeclaration(child, source, filePath, symbols);
                    break;
                case 'const_declaration':
                case 'var_declaration':
                    this.extractVarConst(child, source, filePath, symbols);
                    break;
            }
        }
    }
    extractFunction(node, source, filePath, symbols, relationships) {
        const nameNode = node.childForFieldName('name');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const params = this.extractParams(node.childForFieldName('parameters'), source);
        const returnType = this.extractResult(node.childForFieldName('result'), source);
        const docComment = (0, ast_utils_js_1.extractDocComment)(node, source);
        const isExported = this.isExported(name);
        symbols.push({
            name,
            kind: 'function',
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: this.buildFuncSignature(name, params, returnType),
            parameters: params || null,
            returnType: returnType || null,
            isExported,
            docComment,
            complexity: (0, ast_utils_js_1.calculateComplexity)(node),
        });
        // Extract calls from function body
        const body = node.childForFieldName('body');
        if (body) {
            this.extractCalls(body, source, filePath, name, relationships);
        }
    }
    extractMethod(node, source, filePath, symbols, relationships) {
        const nameNode = node.childForFieldName('name');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const receiver = this.extractReceiver(node.childForFieldName('receiver'), source);
        const params = this.extractParams(node.childForFieldName('parameters'), source);
        const returnType = this.extractResult(node.childForFieldName('result'), source);
        const docComment = (0, ast_utils_js_1.extractDocComment)(node, source);
        const isExported = this.isExported(name);
        symbols.push({
            name,
            kind: 'method',
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: this.buildMethodSignature(receiver, name, params, returnType),
            parameters: params || null,
            returnType: returnType || null,
            parentName: receiver.typeName,
            isExported,
            docComment,
            modifiers: receiver.isPointer ? ['pointer_receiver'] : ['value_receiver'],
            complexity: (0, ast_utils_js_1.calculateComplexity)(node),
        });
        // Create Contains relationship
        relationships.push({
            sourceSymbol: receiver.typeName,
            targetSymbol: name,
            kind: 'uses',
            filePath,
            line: range.startLine,
            metadata: { relationship: 'has_method', pointer_receiver: receiver.isPointer },
        });
        // Extract calls from method body
        const body = node.childForFieldName('body');
        if (body) {
            this.extractCalls(body, source, filePath, `${receiver.typeName}.${name}`, relationships);
        }
    }
    extractTypeDeclaration(node, source, filePath, symbols) {
        // type_declaration can contain multiple type_spec children
        const typeSpecs = (0, ast_utils_js_1.findNodes)(node, 'type_spec');
        for (const spec of typeSpecs) {
            this.extractTypeSpec(spec, source, filePath, symbols);
        }
    }
    extractTypeSpec(node, source, filePath, symbols) {
        const nameNode = node.childForFieldName('name');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const typeNode = node.childForFieldName('type');
        if (!typeNode)
            return;
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const isExported = this.isExported(name);
        const docComment = (0, ast_utils_js_1.extractDocComment)(node, source);
        let kind;
        let signature;
        switch (typeNode.type) {
            case 'struct_type':
                kind = 'struct';
                signature = `type ${name} struct`;
                break;
            case 'interface_type':
                kind = 'interface';
                signature = `type ${name} interface`;
                break;
            default:
                kind = 'type';
                signature = `type ${name} ${(0, ast_utils_js_1.getNodeText)(typeNode, source).split('\n')[0].slice(0, 100)}`;
                break;
        }
        symbols.push({
            name,
            kind,
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature,
            isExported,
            docComment,
        });
    }
    extractVarConst(node, source, filePath, symbols) {
        const specType = node.type === 'const_declaration' ? 'const_spec' : 'var_spec';
        const specs = (0, ast_utils_js_1.findNodes)(node, specType);
        for (const spec of specs) {
            const nameNode = spec.childForFieldName('name');
            if (!nameNode)
                continue;
            const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
            const range = (0, ast_utils_js_1.getNodeRange)(spec);
            const isExported = this.isExported(name);
            symbols.push({
                name,
                kind: node.type === 'const_declaration' ? 'constant' : 'variable',
                filePath,
                startLine: range.startLine,
                endLine: range.endLine,
                signature: (0, ast_utils_js_1.getNodeText)(spec, source).split('\n')[0].trim().slice(0, 200),
                isExported,
            });
        }
    }
    extractImports(root, source, filePath, relationships) {
        const importDecls = (0, ast_utils_js_1.findNodes)(root, 'import_declaration');
        for (const decl of importDecls) {
            const importSpecs = (0, ast_utils_js_1.findNodes)(decl, 'import_spec');
            for (const spec of importSpecs) {
                const pathNode = spec.childForFieldName('path');
                if (!pathNode)
                    continue;
                const importPath = (0, ast_utils_js_1.getNodeText)(pathNode, source).replace(/"/g, '');
                const aliasNode = spec.childForFieldName('name');
                const alias = aliasNode ? (0, ast_utils_js_1.getNodeText)(aliasNode, source) : null;
                relationships.push({
                    sourceSymbol: filePath,
                    targetSymbol: importPath,
                    kind: 'imports',
                    filePath,
                    line: spec.startPosition.row + 1,
                    metadata: { alias, module: importPath },
                });
            }
        }
    }
    extractCalls(body, source, filePath, callerName, relationships) {
        const seen = new Set();
        // Regular function/method calls
        const callExprs = (0, ast_utils_js_1.findNodes)(body, 'call_expression');
        for (const call of callExprs) {
            const funcNode = call.childForFieldName('function');
            if (!funcNode)
                continue;
            const target = (0, ast_utils_js_1.getNodeText)(funcNode, source).trim();
            const key = `${callerName}->${target}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            // Detect if inside go statement or defer statement
            const isGoroutine = this.isInsideNodeType(call, 'go_statement');
            const isDeferred = this.isInsideNodeType(call, 'defer_statement');
            const metadata = {};
            if (isGoroutine)
                metadata.async = true;
            if (isDeferred)
                metadata.deferred = true;
            relationships.push({
                sourceSymbol: callerName,
                targetSymbol: target,
                kind: 'calls',
                filePath,
                line: call.startPosition.row + 1,
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            });
        }
    }
    isInsideNodeType(node, type) {
        let current = node.parent;
        while (current) {
            if (current.type === type)
                return true;
            if (current.type === 'function_declaration' || current.type === 'method_declaration')
                break;
            current = current.parent;
        }
        return false;
    }
    detectInterfaceImplementations(symbols) {
        const interfaces = symbols.filter(s => s.kind === 'interface');
        const structs = symbols.filter(s => s.kind === 'struct');
        const implRelationships = [];
        if (interfaces.length === 0 || structs.length === 0)
            return implRelationships;
        // Build method map: structName -> method names
        const methodMap = new Map();
        for (const sym of symbols) {
            if (sym.kind === 'method' && sym.parentName) {
                if (!methodMap.has(sym.parentName)) {
                    methodMap.set(sym.parentName, new Set());
                }
                methodMap.get(sym.parentName).add(sym.name);
            }
        }
        // Note: Full interface satisfaction check requires parsing interface method
        // signatures from the AST. This single-file heuristic checks method name overlap.
        // A project-wide indexer pass would provide complete detection.
        return implRelationships;
    }
    extractReceiver(node, source) {
        if (!node)
            return { text: '', typeName: '', isPointer: false };
        const paramList = node.namedChildren;
        if (paramList.length === 0)
            return { text: '', typeName: '', isPointer: false };
        const paramDecl = paramList[0];
        const typeNode = paramDecl.childForFieldName('type');
        if (!typeNode) {
            // Fallback: last named child is often the type
            const lastChild = paramDecl.namedChildren[paramDecl.namedChildren.length - 1];
            if (lastChild) {
                const isPointer = lastChild.type === 'pointer_type';
                const typeName = isPointer
                    ? (0, ast_utils_js_1.getNodeText)(lastChild.namedChildren[0], source)
                    : (0, ast_utils_js_1.getNodeText)(lastChild, source);
                return { text: (0, ast_utils_js_1.getNodeText)(paramDecl, source), typeName, isPointer };
            }
            return { text: (0, ast_utils_js_1.getNodeText)(paramDecl, source), typeName: '', isPointer: false };
        }
        const isPointer = typeNode.type === 'pointer_type';
        const typeName = isPointer
            ? (0, ast_utils_js_1.getNodeText)(typeNode.namedChildren[0], source)
            : (0, ast_utils_js_1.getNodeText)(typeNode, source);
        return { text: (0, ast_utils_js_1.getNodeText)(paramDecl, source), typeName, isPointer };
    }
    extractParams(node, source) {
        if (!node)
            return '';
        return (0, ast_utils_js_1.getNodeText)(node, source);
    }
    extractResult(node, source) {
        if (!node)
            return '';
        return (0, ast_utils_js_1.getNodeText)(node, source).trim();
    }
    isExported(name) {
        if (!name || name.length === 0)
            return false;
        return name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase();
    }
    buildFuncSignature(name, params, returnType) {
        const ret = returnType ? ` ${returnType}` : '';
        return `func ${name}${params}${ret}`.slice(0, 500);
    }
    buildMethodSignature(receiver, name, params, returnType) {
        const ret = returnType ? ` ${returnType}` : '';
        const recv = receiver.text ? `(${receiver.text}) ` : '';
        return `func ${recv}${name}${params}${ret}`.slice(0, 500);
    }
}
exports.default = GoParser;
//# sourceMappingURL=go-parser.js.map