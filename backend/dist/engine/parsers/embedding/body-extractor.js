/**
 * KSA-169: Body Extractor — Extract function bodies from tree-sitter AST.
 * Provides full body text for embedding generation.
 */
import { getNodeText, getNodeRange } from '../ast-utils.js';
export class BodyExtractor {
    minBodyLines;
    maxBodyTokens;
    constructor(minBodyLines = 3, maxBodyTokens = 10_000) {
        this.minBodyLines = minBodyLines;
        this.maxBodyTokens = maxBodyTokens;
    }
    extractBody(node, source) {
        const bodyNode = this.findBodyNode(node);
        if (!bodyNode)
            return null;
        const bodyText = getNodeText(bodyNode, source);
        const lineCount = bodyText.split('\n').length;
        if (lineCount < this.minBodyLines)
            return null;
        const tokenCount = this.estimateTokens(bodyText);
        if (tokenCount > this.maxBodyTokens) {
            return this.truncateToTokens(bodyText, this.maxBodyTokens);
        }
        return bodyText;
    }
    extractAllBodies(tree, source, filePath) {
        const bodies = [];
        const functionTypes = new Set([
            'function_declaration', 'method_definition',
            'arrow_function', 'function_expression',
            'generator_function_declaration',
            'function_definition', 'method_declaration',
        ]);
        const stack = [tree.rootNode];
        while (stack.length > 0) {
            const node = stack.pop();
            if (functionTypes.has(node.type)) {
                const body = this.extractBody(node, source);
                if (body) {
                    const name = this.extractFunctionName(node, source);
                    const range = getNodeRange(node);
                    const tokenCount = this.estimateTokens(body);
                    bodies.push({
                        symbolId: `${filePath}:${name}:${range.startLine}`,
                        name,
                        bodyText: body,
                        tokenCount,
                        startLine: range.startLine,
                        endLine: range.endLine,
                    });
                }
            }
            for (let i = node.childCount - 1; i >= 0; i--) {
                const child = node.child(i);
                if (child)
                    stack.push(child);
            }
        }
        return bodies;
    }
    findBodyNode(node) {
        const bodyTypes = ['statement_block', 'block', 'function_body', 'class_body'];
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (child && bodyTypes.includes(child.type))
                return child;
        }
        return null;
    }
    extractFunctionName(node, source) {
        const nameTypes = ['identifier', 'property_identifier', 'type_identifier'];
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (child && nameTypes.includes(child.type)) {
                return getNodeText(child, source);
            }
        }
        if (node.parent?.type === 'variable_declarator') {
            for (let i = 0; i < node.parent.namedChildCount; i++) {
                const child = node.parent.namedChild(i);
                if (child && child.type === 'identifier') {
                    return getNodeText(child, source);
                }
            }
        }
        return '<anonymous>';
    }
    estimateTokens(text) {
        return text.split(/[\s\n\r\t]+/).filter(Boolean).length;
    }
    truncateToTokens(text, maxTokens) {
        const words = text.split(/[\s\n\r\t]+/);
        if (words.length <= maxTokens)
            return text;
        return words.slice(0, maxTokens).join(' ');
    }
}
//# sourceMappingURL=body-extractor.js.map