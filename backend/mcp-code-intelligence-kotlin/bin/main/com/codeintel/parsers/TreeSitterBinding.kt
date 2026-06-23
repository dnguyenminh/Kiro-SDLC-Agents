/**
 * KSA-171/172: Tree-sitter JVM Binding — Process-based tree-sitter integration.
 *
 * Strategy: Uses tree-sitter CLI (node/wasm) as subprocess for AST generation.
 * This avoids JNI complexity while maintaining feature parity with nodejs.
 * Future: Replace with JNI binding when native libs are compiled for all platforms.
 */
package com.codeintel.parsers

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * Concrete implementation of SyntaxNode backed by JSON-deserialized AST.
 */
class TreeSitterNode(
    private val data: ASTNodeData,
    private val sourceText: String,
    private val parentRef: TreeSitterNode? = null,
) : SyntaxNode {
    override val type: String get() = data.type
    override val text: String get() = sourceText.substring(
        data.startByte.coerceAtMost(sourceText.length),
        data.endByte.coerceAtMost(sourceText.length),
    )
    override val startByte: Int get() = data.startByte
    override val endByte: Int get() = data.endByte
    override val startPoint: Point get() = Point(data.startRow, data.startCol)
    override val endPoint: Point get() = Point(data.endRow, data.endCol)
    override val childCount: Int get() = data.children.size
    override val namedChildCount: Int get() = data.children.count { !it.isAnonymous }
    override val hasError: Boolean get() = data.type == "ERROR" || data.children.any { it.type == "ERROR" }
    override val parent: SyntaxNode? get() = parentRef

    override val prevNamedSibling: SyntaxNode?
        get() {
            val p = parentRef ?: return null
            val siblings = p.data.children.filter { !it.isAnonymous }
            val idx = siblings.indexOfFirst { it === data }
            return if (idx > 0) TreeSitterNode(siblings[idx - 1], sourceText, p) else null
        }

    override fun child(index: Int): SyntaxNode? {
        val c = data.children.getOrNull(index) ?: return null
        return TreeSitterNode(c, sourceText, this)
    }

    override fun namedChild(index: Int): SyntaxNode? {
        val named = data.children.filter { !it.isAnonymous }
        val c = named.getOrNull(index) ?: return null
        return TreeSitterNode(c, sourceText, this)
    }

    override fun childByFieldName(name: String): SyntaxNode? {
        val c = data.children.find { it.fieldName == name } ?: return null
        return TreeSitterNode(c, sourceText, this)
    }

    override val children: List<SyntaxNode>
        get() = data.children.map { TreeSitterNode(it, sourceText, this) }

    override val namedChildren: List<SyntaxNode>
        get() = data.children.filter { !it.isAnonymous }.map { TreeSitterNode(it, sourceText, this) }
}
