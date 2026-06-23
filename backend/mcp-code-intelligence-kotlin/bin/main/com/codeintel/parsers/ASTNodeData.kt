/**
 * KSA-171/172: AST Node Data — Serializable AST representation.
 * Used for JSON interchange between tree-sitter process and JVM.
 */
package com.codeintel.parsers

import kotlinx.serialization.Serializable

@Serializable
data class ASTNodeData(
    val type: String,
    val startByte: Int = 0,
    val endByte: Int = 0,
    val startRow: Int = 0,
    val startCol: Int = 0,
    val endRow: Int = 0,
    val endCol: Int = 0,
    val fieldName: String? = null,
    val isAnonymous: Boolean = false,
    val children: List<ASTNodeData> = emptyList(),
)

/**
 * Result of a tree-sitter parse operation.
 */
@Serializable
data class TreeSitterParseResult(
    val root: ASTNodeData,
    val language: String,
    val errors: List<TreeSitterError> = emptyList(),
)

@Serializable
data class TreeSitterError(
    val message: String = "Parse error",
    val row: Int = 0,
    val column: Int = 0,
)
