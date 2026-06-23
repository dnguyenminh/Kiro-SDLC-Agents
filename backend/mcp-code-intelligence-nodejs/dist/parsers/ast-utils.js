"use strict";
/**
 * KSA-145: AST Utilities — Shared tree-sitter AST traversal helpers.
 * Provides efficient iterative tree walking, node search, and text extraction.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.walkTree = walkTree;
exports.findNodes = findNodes;
exports.findFirst = findFirst;
exports.getNodeText = getNodeText;
exports.getNodeRange = getNodeRange;
exports.getAncestorOfType = getAncestorOfType;
exports.getChildrenOfType = getChildrenOfType;
exports.getNamedChild = getNamedChild;
exports.extractDocComment = extractDocComment;
exports.calculateComplexity = calculateComplexity;
/**
 * Iterative depth-first tree walk (avoids stack overflow on deep ASTs).
 * Visitor.enter() returning false skips children.
 */
function walkTree(node, visitor) {
    const stack = [node];
    while (stack.length > 0) {
        const current = stack.pop();
        const shouldDescend = visitor.enter?.(current);
        if (shouldDescend !== false) {
            for (let i = current.childCount - 1; i >= 0; i--) {
                const child = current.child(i);
                if (child)
                    stack.push(child);
            }
        }
        visitor.leave?.(current);
    }
}
/** Find all nodes of a given type in the subtree. */
function findNodes(node, type) {
    const results = [];
    walkTree(node, {
        enter(n) {
            if (n.type === type)
                results.push(n);
        }
    });
    return results;
}
/** Find first node of a given type (stops early). */
function findFirst(node, type) {
    let result = null;
    const stack = [node];
    while (stack.length > 0 && !result) {
        const current = stack.pop();
        if (current.type === type) {
            result = current;
            break;
        }
        for (let i = current.childCount - 1; i >= 0; i--) {
            const child = current.child(i);
            if (child)
                stack.push(child);
        }
    }
    return result;
}
/** Get text content of a node from source. */
function getNodeText(node, source) {
    return source.substring(node.startIndex, node.endIndex);
}
/** Get 1-based line range of a node. */
function getNodeRange(node) {
    return {
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
    };
}
/** Walk up the tree to find an ancestor of a specific type. */
function getAncestorOfType(node, type) {
    let current = node.parent;
    while (current) {
        if (current.type === type)
            return current;
        current = current.parent;
    }
    return null;
}
/** Get direct children of a specific type. */
function getChildrenOfType(node, type) {
    const results = [];
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && child.type === type)
            results.push(child);
    }
    return results;
}
/** Get the first named child of a specific type. */
function getNamedChild(node, type) {
    for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child && child.type === type)
            return child;
    }
    return null;
}
/** Extract doc comment above a node (JSDoc, Python docstring, etc.). */
function extractDocComment(node, source) {
    // Check for preceding comment node
    let prev = node.previousNamedSibling;
    if (!prev) {
        prev = node.parent?.previousNamedSibling ?? null;
    }
    if (prev && prev.type === 'comment') {
        const text = getNodeText(prev, source).trim();
        return text
            .replace(/^\/\*\*?|\*\/$/g, '')
            .replace(/^\s*\*\s?/gm, '')
            .replace(/^\/\/\s?/gm, '')
            .replace(/^#\s?/gm, '')
            .trim()
            .slice(0, 500);
    }
    return null;
}
/** Calculate cyclomatic complexity of a function body. */
function calculateComplexity(node) {
    let complexity = 1;
    const branchTypes = new Set([
        'if_statement', 'elif_clause', 'else_clause',
        'for_statement', 'while_statement', 'do_statement',
        'switch_case', 'catch_clause', 'ternary_expression',
        'conditional_expression', 'logical_expression',
        'for_in_statement', 'for_of_statement',
        'when_entry', 'match_arm',
    ]);
    walkTree(node, {
        enter(n) {
            if (branchTypes.has(n.type))
                complexity++;
            if (n.type === '&&' || n.type === '||')
                complexity++;
        }
    });
    return complexity;
}
//# sourceMappingURL=ast-utils.js.map