"use strict";
/**
 * KSA-146: TypeScript Symbol Extractor.
 * Extracts functions, classes, interfaces, type aliases, enums, and arrow functions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TSSymbolExtractor = void 0;
const ast_utils_js_1 = require("../ast-utils.js");
const ts_utils_js_1 = require("./ts-utils.js");
class TSSymbolExtractor {
    extract(rootNode, source, filePath, relationships) {
        const symbols = [];
        this.extractFromNode(rootNode, source, filePath, null, symbols, relationships);
        return symbols;
    }
    extractFromNode(node, source, filePath, parentName, symbols, relationships) {
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (!child)
                continue;
            switch (child.type) {
                case 'function_declaration':
                case 'generator_function_declaration':
                    this.extractFunction(child, source, filePath, parentName, symbols);
                    break;
                case 'class_declaration':
                    this.extractClass(child, source, filePath, parentName, symbols, relationships);
                    break;
                case 'interface_declaration':
                    this.extractInterface(child, source, filePath, parentName, symbols);
                    break;
                case 'type_alias_declaration':
                    this.extractTypeAlias(child, source, filePath, parentName, symbols);
                    break;
                case 'enum_declaration':
                    this.extractEnum(child, source, filePath, parentName, symbols);
                    break;
                case 'lexical_declaration':
                case 'variable_declaration':
                    this.extractVariableDeclaration(child, source, filePath, parentName, symbols);
                    break;
                case 'export_statement':
                    this.extractFromNode(child, source, filePath, parentName, symbols, relationships);
                    break;
            }
        }
    }
    extractFunction(node, source, filePath, parentName, symbols) {
        const nameNode = (0, ast_utils_js_1.getNamedChild)(node, 'identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const params = (0, ts_utils_js_1.extractParameters)(node, source);
        const returnType = (0, ts_utils_js_1.extractReturnType)(node, source);
        const exported = (0, ts_utils_js_1.isExported)(node);
        const isAsync = (0, ts_utils_js_1.hasModifier)(node, source, 'async');
        const docComment = (0, ast_utils_js_1.extractDocComment)(node, source);
        const decorators = (0, ts_utils_js_1.extractDecorators)(node, source);
        symbols.push({
            name,
            kind: parentName ? 'method' : 'function',
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: (0, ts_utils_js_1.buildFunctionSignature)(name, params, returnType, isAsync),
            parameters: params,
            returnType,
            isAsync,
            isExported: exported,
            parentName,
            docComment,
            complexity: (0, ast_utils_js_1.calculateComplexity)(node),
            decorators: decorators.length > 0 ? decorators : undefined,
        });
    }
    extractClass(node, source, filePath, parentName, symbols, relationships) {
        const nameNode = (0, ast_utils_js_1.getNamedChild)(node, 'type_identifier') ?? (0, ast_utils_js_1.getNamedChild)(node, 'identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const exported = (0, ts_utils_js_1.isExported)(node);
        const docComment = (0, ast_utils_js_1.extractDocComment)(node, source);
        const decorators = (0, ts_utils_js_1.extractDecorators)(node, source);
        const modifiers = (0, ts_utils_js_1.extractModifiers)(node, source);
        const isAbstract = modifiers.includes('abstract');
        symbols.push({
            name,
            kind: 'class',
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: `${isAbstract ? 'abstract ' : ''}class ${name}`,
            isExported: exported,
            parentName,
            docComment,
            modifiers: modifiers.length > 0 ? modifiers : undefined,
            decorators: decorators.length > 0 ? decorators : undefined,
        });
        // Extract class body members
        const body = (0, ast_utils_js_1.getNamedChild)(node, 'class_body');
        if (body) {
            this.extractClassMembers(body, source, filePath, name, symbols);
        }
    }
    extractClassMembers(body, source, filePath, className, symbols) {
        for (let i = 0; i < body.namedChildCount; i++) {
            const member = body.namedChild(i);
            if (!member)
                continue;
            switch (member.type) {
                case 'method_definition':
                    this.extractMethod(member, source, filePath, className, symbols);
                    break;
                case 'public_field_definition':
                case 'property_definition':
                    this.extractProperty(member, source, filePath, className, symbols);
                    break;
            }
        }
    }
    extractMethod(node, source, filePath, className, symbols) {
        const nameNode = (0, ast_utils_js_1.getNamedChild)(node, 'property_identifier') ?? (0, ast_utils_js_1.getNamedChild)(node, 'identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const params = (0, ts_utils_js_1.extractParameters)(node, source);
        const returnType = (0, ts_utils_js_1.extractReturnType)(node, source);
        const isAsync = (0, ts_utils_js_1.hasModifier)(node, source, 'async');
        const docComment = (0, ast_utils_js_1.extractDocComment)(node, source);
        const kind = name === 'constructor' ? 'constructor' : 'method';
        const modifiers = (0, ts_utils_js_1.extractModifiers)(node, source);
        const decorators = (0, ts_utils_js_1.extractDecorators)(node, source);
        symbols.push({
            name,
            kind,
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: (0, ts_utils_js_1.buildFunctionSignature)(name, params, returnType, isAsync),
            parameters: params,
            returnType,
            isAsync,
            parentName: className,
            docComment,
            complexity: (0, ast_utils_js_1.calculateComplexity)(node),
            modifiers: modifiers.length > 0 ? modifiers : undefined,
            decorators: decorators.length > 0 ? decorators : undefined,
        });
    }
    extractProperty(node, source, filePath, className, symbols) {
        const nameNode = (0, ast_utils_js_1.getNamedChild)(node, 'property_identifier') ?? (0, ast_utils_js_1.getNamedChild)(node, 'identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const modifiers = (0, ts_utils_js_1.extractModifiers)(node, source);
        symbols.push({
            name,
            kind: 'property',
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: (0, ast_utils_js_1.getNodeText)(node, source).split('\n')[0].trim().slice(0, 200),
            parentName: className,
            modifiers: modifiers.length > 0 ? modifiers : undefined,
        });
    }
    extractInterface(node, source, filePath, parentName, symbols) {
        const nameNode = (0, ast_utils_js_1.getNamedChild)(node, 'type_identifier') ?? (0, ast_utils_js_1.getNamedChild)(node, 'identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const exported = (0, ts_utils_js_1.isExported)(node);
        const docComment = (0, ast_utils_js_1.extractDocComment)(node, source);
        symbols.push({
            name,
            kind: 'interface',
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: `interface ${name}`,
            isExported: exported,
            parentName,
            docComment,
        });
    }
    extractTypeAlias(node, source, filePath, parentName, symbols) {
        const nameNode = (0, ast_utils_js_1.getNamedChild)(node, 'type_identifier') ?? (0, ast_utils_js_1.getNamedChild)(node, 'identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const exported = (0, ts_utils_js_1.isExported)(node);
        symbols.push({
            name,
            kind: 'type',
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: (0, ast_utils_js_1.getNodeText)(node, source).split('\n')[0].trim().slice(0, 200),
            isExported: exported,
            parentName,
        });
    }
    extractEnum(node, source, filePath, parentName, symbols) {
        const nameNode = (0, ast_utils_js_1.getNamedChild)(node, 'identifier');
        if (!nameNode)
            return;
        const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
        const range = (0, ast_utils_js_1.getNodeRange)(node);
        const exported = (0, ts_utils_js_1.isExported)(node);
        symbols.push({
            name,
            kind: 'enum',
            filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            signature: `enum ${name}`,
            isExported: exported,
            parentName,
        });
    }
    extractVariableDeclaration(node, source, filePath, parentName, symbols) {
        for (let i = 0; i < node.namedChildCount; i++) {
            const declarator = node.namedChild(i);
            if (!declarator || declarator.type !== 'variable_declarator')
                continue;
            const nameNode = (0, ast_utils_js_1.getNamedChild)(declarator, 'identifier');
            if (!nameNode)
                continue;
            const name = (0, ast_utils_js_1.getNodeText)(nameNode, source);
            const value = (0, ast_utils_js_1.getNamedChild)(declarator, 'arrow_function') ??
                (0, ast_utils_js_1.getNamedChild)(declarator, 'function_expression') ??
                (0, ast_utils_js_1.getNamedChild)(declarator, 'function');
            if (value) {
                const range = (0, ast_utils_js_1.getNodeRange)(node);
                const params = (0, ts_utils_js_1.extractParameters)(value, source);
                const returnType = (0, ts_utils_js_1.extractReturnType)(value, source);
                const exported = (0, ts_utils_js_1.isExported)(node);
                const isAsync = (0, ts_utils_js_1.hasModifier)(value, source, 'async');
                const docComment = (0, ast_utils_js_1.extractDocComment)(node, source);
                symbols.push({
                    name,
                    kind: 'function',
                    filePath,
                    startLine: range.startLine,
                    endLine: range.endLine,
                    signature: (0, ts_utils_js_1.buildFunctionSignature)(name, params, returnType, isAsync),
                    parameters: params,
                    returnType,
                    isAsync,
                    isExported: exported,
                    parentName,
                    docComment,
                    complexity: (0, ast_utils_js_1.calculateComplexity)(value),
                });
            }
        }
    }
}
exports.TSSymbolExtractor = TSSymbolExtractor;
//# sourceMappingURL=ts-symbol-extractor.js.map