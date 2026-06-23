/**
 * KSA-172: Tree-sitter Core Integration — Type definitions.
 * Matches nodejs AST structure exactly.
 */
package com.codeintel.parsers

import kotlinx.serialization.Serializable

@Serializable
data class ExtractedSymbol(
    val name: String,
    val kind: String,
    val filePath: String,
    val startLine: Int,
    val endLine: Int,
    val signature: String,
    val parameters: String? = null,
    val returnType: String? = null,
    val modifiers: List<String>? = null,
    val decorators: List<String>? = null,
    val parentName: String? = null,
    val isAsync: Boolean? = null,
    val isExported: Boolean? = null,
    val docComment: String? = null,
    val complexity: Int? = null,
)

@Serializable
data class ExtractedRelationship(
    val sourceSymbol: String,
    val targetSymbol: String,
    val kind: String,
    val filePath: String? = null,
    val line: Int = 0,
    val metadata: Map<String, String>? = null,
)

@Serializable
data class ParseError(
    val message: String,
    val line: Int,
    val column: Int,
)

data class ParseResult(
    val symbols: List<ExtractedSymbol> = emptyList(),
    val relationships: List<ExtractedRelationship> = emptyList(),
    val errors: List<ParseError> = emptyList(),
)

data class IndexResult(
    val filePath: String,
    val symbolCount: Int,
    val relationshipCount: Int,
    val parseErrors: Int,
    val duration: Long,
    val method: String,
)

interface ILanguageParser {
    val languageId: String
    fun parse(source: String, filePath: String): ParseResult
    fun getSupportedExtensions(): List<String>
}
