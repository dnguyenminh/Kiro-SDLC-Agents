/**
 * KSA-146: TypeScript Call Relationship Extractor.
 * Extracts function call relationships and constructor invocations.
 */
import { getNodeText, findNodes, getNamedChild } from '../ast-utils.js';
export class TSCallExtractor {
    extract(rootNode, source, filePath, symbols) {
        const relationships = [];
        // For each function/method symbol, find calls within its body
        for (const symbol of symbols) {
            if (!['function', 'method', 'constructor'].includes(symbol.kind))
                continue;
            // Find the AST node for this symbol by line range
            const symbolNode = this.findSymbolNode(rootNode, symbol);
            if (!symbolNode)
                continue;
            const bodyNode = getNamedChild(symbolNode, 'statement_block') ??
                getNamedChild(symbolNode, 'body');
            if (!bodyNode)
                continue;
            const callerName = symbol.parentName
                ? `${symbol.parentName}.${symbol.name}`
                : symbol.name;
            this.extractCallsFromBody(bodyNode, source, filePath, callerName, relationships);
        }
        return relationships;
    }
    extractCallsFromBody(body, source, filePath, callerName, relationships) {
        const callNodes = findNodes(body, 'call_expression');
        const seen = new Set();
        for (const call of callNodes) {
            const target = this.resolveCallTarget(call, source);
            if (!target)
                continue;
            // Skip common noise
            if (target.startsWith('console.') || target === 'require')
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
        // Find new_expression nodes (constructor calls)
        const newNodes = findNodes(body, 'new_expression');
        for (const newNode of newNodes) {
            const constructor = this.resolveNewTarget(newNode, source);
            if (!constructor)
                continue;
            const key = `${callerName}->new ${constructor}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            relationships.push({
                sourceSymbol: callerName,
                targetSymbol: `${constructor}.constructor`,
                kind: 'calls',
                filePath,
                line: newNode.startPosition.row + 1,
                metadata: { isConstructor: true },
            });
        }
    }
    resolveCallTarget(callNode, source) {
        const funcNode = callNode.child(0);
        if (!funcNode)
            return null;
        switch (funcNode.type) {
            case 'identifier':
                return getNodeText(funcNode, source);
            case 'member_expression':
                return this.resolveMemberExpression(funcNode, source);
            default:
                return null;
        }
    }
    resolveMemberExpression(node, source) {
        const object = node.childForFieldName?.('object') ?? node.child(0);
        const property = node.childForFieldName?.('property') ?? node.child(2);
        if (!object || !property)
            return getNodeText(node, source).split('(')[0].trim();
        const objText = object.type === 'member_expression'
            ? this.resolveMemberExpression(object, source)
            : getNodeText(object, source);
        return `${objText}.${getNodeText(property, source)}`;
    }
    resolveNewTarget(newNode, source) {
        for (let i = 0; i < newNode.namedChildCount; i++) {
            const child = newNode.namedChild(i);
            if (!child)
                continue;
            if (child.type === 'identifier' || child.type === 'type_identifier') {
                return getNodeText(child, source);
            }
            if (child.type === 'member_expression') {
                return this.resolveMemberExpression(child, source);
            }
        }
        return null;
    }
    findSymbolNode(rootNode, symbol) {
        const targetLine = symbol.startLine - 1; // 0-based
        let result = null;
        const stack = [rootNode];
        while (stack.length > 0) {
            const node = stack.pop();
            if (node.startPosition.row === targetLine) {
                const funcTypes = [
                    'function_declaration', 'generator_function_declaration',
                    'method_definition', 'arrow_function', 'function_expression',
                ];
                if (funcTypes.includes(node.type)) {
                    result = node;
                    break;
                }
                if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
                    result = node;
                    break;
                }
            }
            for (let i = node.childCount - 1; i >= 0; i--) {
                const child = node.child(i);
                if (child)
                    stack.push(child);
            }
        }
        return result;
    }
}
//# sourceMappingURL=ts-call-extractor.js.map