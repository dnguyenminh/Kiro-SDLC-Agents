/**
 * KSA-172: Base Language Parser — Shared extraction logic.
 * Uses regex-based parsing (tree-sitter JNI upgrade path available).
 */
package com.codeintel.parsers.languages

import com.codeintel.parsers.*

abstract class BaseLanguageParser(
    override val languageId: String,
) : ILanguageParser {

    protected fun buildSymbol(
        name: String, kind: String, filePath: String,
        startLine: Int, endLine: Int, signature: String,
        parameters: String? = null, returnType: String? = null,
        modifiers: List<String>? = null, decorators: List<String>? = null,
        parentName: String? = null, isAsync: Boolean? = null,
        isExported: Boolean? = null, docComment: String? = null,
        complexity: Int? = null,
    ) = ExtractedSymbol(
        name = name, kind = kind, filePath = filePath,
        startLine = startLine, endLine = endLine, signature = signature.take(500),
        parameters = parameters, returnType = returnType,
        modifiers = modifiers?.takeIf { it.isNotEmpty() },
        decorators = decorators?.takeIf { it.isNotEmpty() },
        parentName = parentName, isAsync = isAsync, isExported = isExported,
        docComment = docComment?.take(500), complexity = complexity,
    )

    protected fun buildRelationship(
        sourceSymbol: String, targetSymbol: String, kind: String,
        filePath: String? = null, line: Int = 0,
        metadata: Map<String, String>? = null,
    ) = ExtractedRelationship(
        sourceSymbol = sourceSymbol, targetSymbol = targetSymbol,
        kind = kind, filePath = filePath, line = line,
        metadata = metadata?.takeIf { it.isNotEmpty() },
    )
}
