/**
 * KSA-172: AST Utilities — Shared tree-sitter AST traversal helpers.
 * Port of mcp-code-intelligence-nodejs/src/parsers/ast-utils.ts.
 */
package com.codeintel.parsers

/**
 * Represents a tree-sitter syntax node.
 * Platform-agnostic wrapper for tree-sitter JNI binding.
 */
interface SyntaxNode {
    val type: String
    val text: String
    val startByte: Int
    val endByte: Int
    val startPoint: Point
    val endPoint: Point
    val childCount: Int
    val namedChildCount: Int
    val hasError: Boolean
    val parent: SyntaxNode?
    val prevNamedSibling: SyntaxNode?
    fun child(index: Int): SyntaxNode?
    fun namedChild(index: Int): SyntaxNode?
    fun childByFieldName(name: String): SyntaxNode?
    val children: List<SyntaxNode>
    val namedChildren: List<SyntaxNode>
}

data class Point(val row: Int, val column: Int)

inline fun walkTree(node: SyntaxNode, enter: (SyntaxNode) -> Boolean) {
    val stack = ArrayDeque<SyntaxNode>()
    stack.addLast(node)
    while (stack.isNotEmpty()) {
        val current = stack.removeLast()
        if (enter(current)) {
            for (i in current.childCount - 1 downTo 0) {
                current.child(i)?.let { stack.addLast(it) }
            }
        }
    }
}

fun findNodes(node: SyntaxNode, type: String): List<SyntaxNode> {
    val results = mutableListOf<SyntaxNode>()
    walkTree(node) { n -> if (n.type == type) results.add(n); true }
    return results
}

fun findFirst(node: SyntaxNode, type: String): SyntaxNode? {
    val stack = ArrayDeque<SyntaxNode>()
    stack.addLast(node)
    while (stack.isNotEmpty()) {
        val current = stack.removeLast()
        if (current.type == type) return current
        for (i in current.childCount - 1 downTo 0) {
            current.child(i)?.let { stack.addLast(it) }
        }
    }
    return null
}

fun getNodeText(node: SyntaxNode, source: String): String =
    source.substring(node.startByte, node.endByte)

fun getNodeRange(node: SyntaxNode): Pair<Int, Int> =
    (node.startPoint.row + 1) to (node.endPoint.row + 1)

fun getNamedChild(node: SyntaxNode, type: String): SyntaxNode? {
    for (i in 0 until node.namedChildCount) {
        val child = node.namedChild(i)
        if (child?.type == type) return child
    }
    return null
}

fun getAncestorOfType(node: SyntaxNode, type: String): SyntaxNode? {
    var current = node.parent
    while (current != null) {
        if (current.type == type) return current
        current = current.parent
    }
    return null
}

fun extractDocComment(node: SyntaxNode, source: String): String? {
    val prev = node.prevNamedSibling ?: node.parent?.prevNamedSibling ?: return null
    if (prev.type != "comment") return null
    return getNodeText(prev, source).trim()
        .replace(Regex("^/\\*\\*?|\\*/$"), "")
        .replace(Regex("^\\s*\\*\\s?", RegexOption.MULTILINE), "")
        .replace(Regex("^//\\s?", RegexOption.MULTILINE), "")
        .trim().take(500).ifEmpty { null }
}

fun calculateComplexity(node: SyntaxNode): Int {
    var complexity = 1
    val branchTypes = setOf(
        "if_statement", "elif_clause", "for_statement", "while_statement",
        "do_statement", "switch_case", "catch_clause", "ternary_expression",
        "conditional_expression", "when_entry", "match_arm",
    )
    walkTree(node) { n ->
        if (n.type in branchTypes) complexity++
        if (n.type == "&&" || n.type == "||") complexity++
        true
    }
    return complexity
}
