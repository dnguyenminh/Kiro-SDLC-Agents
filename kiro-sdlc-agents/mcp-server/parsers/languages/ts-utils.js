"use strict";
/**
 * KSA-146: TypeScript-specific AST helpers.
 * Utility functions for extracting TypeScript/JavaScript-specific constructs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isExported = isExported;
exports.hasModifier = hasModifier;
exports.extractParameters = extractParameters;
exports.extractReturnType = extractReturnType;
exports.buildFunctionSignature = buildFunctionSignature;
exports.extractDecorators = extractDecorators;
exports.extractHeritage = extractHeritage;
exports.extractModifiers = extractModifiers;
const ast_utils_js_1 = require("../ast-utils.js");
/** Check if a node is exported (direct export or parent is export_statement). */
function isExported(node) {
    const parent = node.parent;
    return parent?.type === 'export_statement';
}
/** Check if a node has a specific modifier keyword (async, static, etc.). */
function hasModifier(node, source, modifier) {
    const text = (0, ast_utils_js_1.getNodeText)(node, source);
    const firstLine = text.split('\n')[0];
    return firstLine.includes(modifier);
}
/** Extract formal parameters text from a function/method node. */
function extractParameters(node, source) {
    const params = (0, ast_utils_js_1.getNamedChild)(node, 'formal_parameters');
    if (!params)
        return '';
    return (0, ast_utils_js_1.getNodeText)(params, source);
}
/** Extract return type annotation from a function/method node. */
function extractReturnType(node, source) {
    const typeAnnotation = (0, ast_utils_js_1.getNamedChild)(node, 'type_annotation');
    if (!typeAnnotation)
        return undefined;
    return (0, ast_utils_js_1.getNodeText)(typeAnnotation, source).replace(/^:\s*/, '');
}
/** Build a function signature string. */
function buildFunctionSignature(name, params, returnType, isAsync) {
    const prefix = isAsync ? 'async ' : '';
    const ret = returnType ? `: ${returnType}` : '';
    return `${prefix}function ${name}${params}${ret}`.slice(0, 500);
}
/** Extract decorators/annotations from a node. */
function extractDecorators(node, source) {
    const decorators = [];
    for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child && child.type === 'decorator') {
            const text = (0, ast_utils_js_1.getNodeText)(child, source).replace(/^@/, '').split('(')[0].trim();
            decorators.push(text);
        }
    }
    return decorators;
}
/** Extract heritage clauses (extends/implements) from class header text. */
function extractHeritage(node, source) {
    const results = [];
    const text = (0, ast_utils_js_1.getNodeText)(node, source).split('{')[0];
    const extendsMatch = text.match(/extends\s+(\w+)/);
    if (extendsMatch) {
        results.push({ name: extendsMatch[1], kind: 'inherits' });
    }
    const implMatch = text.match(/implements\s+([\w,\s]+)/);
    if (implMatch) {
        const names = implMatch[1].split(',').map(n => n.trim()).filter(Boolean);
        for (const name of names) {
            results.push({ name: name.split('<')[0].trim(), kind: 'implements' });
        }
    }
    return results;
}
/** Extract modifiers (public, private, protected, static, abstract, readonly). */
function extractModifiers(node, source) {
    const modifiers = [];
    const text = (0, ast_utils_js_1.getNodeText)(node, source).split('\n')[0];
    const keywords = ['public', 'private', 'protected', 'static', 'abstract', 'readonly', 'override'];
    for (const kw of keywords) {
        if (text.includes(kw))
            modifiers.push(kw);
    }
    return modifiers;
}
//# sourceMappingURL=ts-utils.js.map