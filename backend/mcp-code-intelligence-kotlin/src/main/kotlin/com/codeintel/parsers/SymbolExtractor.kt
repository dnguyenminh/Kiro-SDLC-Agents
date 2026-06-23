/**
 * KSA-171/172: Symbol Extractor — Extracts symbols from tree-sitter AST nodes.
 * Generic extractor that delegates to language-specific patterns.
 * Produces ExtractedSymbol instances matching nodejs output format.
 */
package com.codeintel.parsers

/**
 * Extracts symbols from a parsed AST tree.
 * Each language parser implements its own extraction logic using the
 * SyntaxNode interface and AstUtils helpers.
 */
class SymbolExtractor {

    fun extractFromRoot(
        root: SyntaxNode,
        source: String,
        filePath: String,
        languageId: String,
    ): ParseResult {
        val symbols = mutableListOf<ExtractedSymbol>()
        val relationships = mutableListOf<ExtractedRelationship>()
        val errors = mutableListOf<ParseError>()

        if (root.hasError) {
            collectErrors(root, errors)
        }

        extractSymbolsRecursive(root, source, filePath, symbols, relationships)
        return ParseResult(symbols, relationships, errors)
    }

    private fun extractSymbolsRecursive(
        node: SyntaxNode,
        source: String,
        filePath: String,
        symbols: MutableList<ExtractedSymbol>,
        relationships: MutableList<ExtractedRelationship>,
    ) {
        when (node.type) {
            "function_declaration",
            "function_definition",
            "method_definition",
            -> extractFunction(node, source, filePath, symbols)

            "class_declaration",
            "class_definition",
            -> extractClass(node, source, filePath, symbols, relationships)

            "interface_declaration" -> extractInterface(node, source, filePath, symbols)

            "import_statement",
            "import_from_statement",
            -> extractImport(node, source, filePath, relationships)
        }

        for (child in node.namedChildren) {
            extractSymbolsRecursive(child, source, filePath, symbols, relationships)
        }
    }

    private fun extractFunction(
        node: SyntaxNode,
        source: String,
        filePath: String,
        symbols: MutableList<ExtractedSymbol>,
    ) {
        val nameNode = node.childByFieldName("name") ?: return
        val name = getNodeText(nameNode, source)
        val params = node.childByFieldName("parameters")
            ?.let { getNodeText(it, source) } ?: "()"
        val returnType = node.childByFieldName("return_type")
            ?.let { getNodeText(it, source) }
        val (startLine, endLine) = getNodeRange(node)
        val signature = buildSignature(node, name, params, source)
        val docComment = extractDocComment(node, source)
        val complexity = calculateComplexity(node)

        symbols.add(
            ExtractedSymbol(
                name = name,
                kind = if (getAncestorOfType(node, "class_declaration") != null) "method" else "function",
                filePath = filePath,
                startLine = startLine,
                endLine = endLine,
                signature = signature.take(500),
                parameters = params,
                returnType = returnType,
                isAsync = isAsyncFunction(node),
                isExported = isExportedNode(node),
                docComment = docComment,
                complexity = complexity,
            ),
        )
    }

    private fun extractClass(
        node: SyntaxNode,
        source: String,
        filePath: String,
        symbols: MutableList<ExtractedSymbol>,
        relationships: MutableList<ExtractedRelationship>,
    ) {
        val nameNode = node.childByFieldName("name") ?: return
        val name = getNodeText(nameNode, source)
        val (startLine, endLine) = getNodeRange(node)
        val modifiers = extractModifiers(node, source)

        symbols.add(
            ExtractedSymbol(
                name = name,
                kind = "class",
                filePath = filePath,
                startLine = startLine,
                endLine = endLine,
                signature = "class $name",
                modifiers = modifiers.takeIf { it.isNotEmpty() },
                isExported = isExportedNode(node),
                docComment = extractDocComment(node, source),
            ),
        )

        val superclass = node.childByFieldName("superclass")
            ?: node.childByFieldName("superTypes")
        if (superclass != null) {
            relationships.add(
                ExtractedRelationship(
                    sourceSymbol = name,
                    targetSymbol = getNodeText(superclass, source),
                    kind = "inherits",
                    filePath = filePath,
                    line = startLine,
                ),
            )
        }
    }

    private fun extractInterface(
        node: SyntaxNode,
        source: String,
        filePath: String,
        symbols: MutableList<ExtractedSymbol>,
    ) {
        val nameNode = node.childByFieldName("name") ?: return
        val name = getNodeText(nameNode, source)
        val (startLine, endLine) = getNodeRange(node)

        symbols.add(
            ExtractedSymbol(
                name = name,
                kind = "interface",
                filePath = filePath,
                startLine = startLine,
                endLine = endLine,
                signature = "interface $name",
                isExported = isExportedNode(node),
                docComment = extractDocComment(node, source),
            ),
        )
    }

    private fun extractImport(
        node: SyntaxNode,
        source: String,
        filePath: String,
        relationships: MutableList<ExtractedRelationship>,
    ) {
        val moduleNode = node.childByFieldName("module_name")
            ?: node.childByFieldName("source")
        val target = moduleNode?.let { getNodeText(it, source) }
            ?: getNodeText(node, source).substringAfter("import").trim()
        val (line, _) = getNodeRange(node)

        relationships.add(
            ExtractedRelationship(
                sourceSymbol = "__file__",
                targetSymbol = target.trim('"', '\''),
                kind = "imports",
                filePath = filePath,
                line = line,
            ),
        )
    }

    private fun buildSignature(
        node: SyntaxNode,
        name: String,
        params: String,
        source: String,
    ): String {
        val async = if (isAsyncFunction(node)) "async " else ""
        val returnType = node.childByFieldName("return_type")
            ?.let { ": ${getNodeText(it, source)}" } ?: ""
        return "${async}function $name$params$returnType"
    }

    private fun isAsyncFunction(node: SyntaxNode): Boolean =
        node.type.startsWith("async") || node.children.any { it.type == "async" }

    private fun isExportedNode(node: SyntaxNode): Boolean {
        val parent = node.parent ?: return false
        return parent.type == "export_statement" ||
            node.children.any { it.type == "export" || it.type == "public" }
    }

    private fun extractModifiers(node: SyntaxNode, source: String): List<String> {
        val modifiers = mutableListOf<String>()
        for (child in node.children) {
            when (child.type) {
                "abstract", "public", "private", "protected",
                "static", "final", "sealed", "open", "data",
                -> modifiers.add(child.type)
                "modifiers" -> {
                    for (mod in child.namedChildren) {
                        modifiers.add(getNodeText(mod, source))
                    }
                }
            }
        }
        return modifiers
    }

    private fun collectErrors(node: SyntaxNode, errors: MutableList<ParseError>) {
        if (node.type == "ERROR") {
            errors.add(ParseError("Parse error", node.startPoint.row + 1, node.startPoint.column))
        }
        if (errors.size >= 10) return
        for (child in node.children) {
            collectErrors(child, errors)
            if (errors.size >= 10) return
        }
    }
}
