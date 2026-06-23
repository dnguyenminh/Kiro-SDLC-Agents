/**
 * KSA-169: Body Extractor — Extract function bodies from tree-sitter AST.
 */
package com.codeintel.parsers.embedding

import com.codeintel.parsers.SyntaxNode
import com.codeintel.parsers.getNodeText
import com.codeintel.parsers.getNodeRange
import com.codeintel.parsers.getNamedChild

data class FunctionBody(
    val symbolId: String,
    val name: String,
    val bodyText: String,
    val tokenCount: Int,
    val startLine: Int,
    val endLine: Int,
)

class BodyExtractor(
    private val minBodyLines: Int = 3,
    private val maxBodyTokens: Int = 10_000,
) {
    private val bodyTypes = setOf("statement_block", "block", "function_body", "class_body")
    private val functionTypes = setOf(
        "function_declaration", "method_definition", "arrow_function",
        "function_expression", "generator_function_declaration",
        "function_definition", "method_declaration",
    )
    private val nameTypes = setOf("identifier", "property_identifier", "type_identifier")

    fun extractBody(node: SyntaxNode, source: String): String? {
        val bodyNode = findBodyNode(node) ?: return null
        val bodyText = getNodeText(bodyNode, source)
        if (bodyText.split("\n").size < minBodyLines) return null
        val tokenCount = estimateTokens(bodyText)
        return if (tokenCount > maxBodyTokens) truncateToTokens(bodyText, maxBodyTokens) else bodyText
    }

    fun extractAllBodies(rootNode: SyntaxNode, source: String, filePath: String): List<FunctionBody> {
        val bodies = mutableListOf<FunctionBody>()
        val stack = ArrayDeque<SyntaxNode>()
        stack.addLast(rootNode)
        while (stack.isNotEmpty()) {
            val node = stack.removeLast()
            if (node.type in functionTypes) {
                val body = extractBody(node, source)
                if (body != null) {
                    val name = extractFunctionName(node, source)
                    val (startLine, endLine) = getNodeRange(node)
                    bodies.add(FunctionBody(
                        symbolId = "$filePath:$name:$startLine",
                        name = name, bodyText = body,
                        tokenCount = estimateTokens(body),
                        startLine = startLine, endLine = endLine,
                    ))
                }
            }
            for (i in node.childCount - 1 downTo 0) {
                node.child(i)?.let { stack.addLast(it) }
            }
        }
        return bodies
    }

    private fun findBodyNode(node: SyntaxNode): SyntaxNode? {
        for (i in 0 until node.namedChildCount) {
            val child = node.namedChild(i)
            if (child != null && child.type in bodyTypes) return child
        }
        return null
    }

    private fun extractFunctionName(node: SyntaxNode, source: String): String {
        for (i in 0 until node.namedChildCount) {
            val child = node.namedChild(i)
            if (child != null && child.type in nameTypes) return getNodeText(child, source)
        }
        val parent = node.parent
        if (parent?.type == "variable_declarator") {
            for (i in 0 until parent.namedChildCount) {
                val child = parent.namedChild(i)
                if (child?.type == "identifier") return getNodeText(child, source)
            }
        }
        return "<anonymous>"
    }

    private fun estimateTokens(text: String): Int =
        text.split(Regex("[\\s\\n\\r\\t]+")).count { it.isNotEmpty() }

    private fun truncateToTokens(text: String, maxTokens: Int): String =
        text.split(Regex("[\\s\\n\\r\\t]+")).take(maxTokens).joinToString(" ")
}
