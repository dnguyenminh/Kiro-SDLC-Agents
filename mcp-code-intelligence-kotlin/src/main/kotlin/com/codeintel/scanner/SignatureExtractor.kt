/** Signature extractor — multi-language regex-based symbol extraction. */
package com.codeintel.scanner

data class Symbol(
    val name: String,
    val kind: String,
    val signature: String,
    val startLine: Int,
    val endLine: Int,
    val parentSymbol: String?,
    val visibility: String?,
    val docComment: String?
)

/** Extract symbols from source content based on language. */
fun extractSymbols(content: String, language: String): List<Symbol> {
    val patterns = getPatterns(language)
    if (patterns.isEmpty()) return emptyList()
    val lines = content.split("\n")
    val symbols = mutableListOf<Symbol>()
    for (pattern in patterns) {
        extractWithPattern(lines, content, pattern, symbols)
    }
    return deduplicate(symbols)
}

private fun extractWithPattern(
    lines: List<String>, content: String,
    pattern: PatternDef, symbols: MutableList<Symbol>
) {
    val matches = pattern.regex.findAll(content)
    for (match in matches) {
        val name = match.groups[pattern.nameGroup]?.value ?: continue
        if (name.length > 100) continue
        val startLine = content.substring(0, match.range.first).count { it == '\n' } + 1
        symbols.add(Symbol(
            name = name,
            kind = pattern.kind,
            signature = match.value.trim().take(500),
            startLine = startLine,
            endLine = estimateEndLine(lines, startLine),
            parentSymbol = null,
            visibility = extractVisibility(match.value),
            docComment = extractDocComment(lines, startLine - 1)
        ))
    }
}

private fun estimateEndLine(lines: List<String>, startLine: Int): Int {
    var depth = 0; var foundOpen = false
    for (i in (startLine - 1) until minOf(lines.size, startLine + 200)) {
        for (ch in lines[i]) {
            if (ch == '{') { depth++; foundOpen = true }
            else if (ch == '}') depth--
        }
        if (foundOpen && depth <= 0) return i + 1
    }
    return minOf(startLine + 1, lines.size)
}

private fun extractVisibility(text: String): String? = when {
    "\\bpublic\\b".toRegex().containsMatchIn(text) -> "public"
    "\\bpub\\b".toRegex().containsMatchIn(text) -> "public"
    "\\bprivate\\b".toRegex().containsMatchIn(text) -> "private"
    "\\bprotected\\b".toRegex().containsMatchIn(text) -> "protected"
    "\\binternal\\b".toRegex().containsMatchIn(text) -> "internal"
    "\\bexport\\b".toRegex().containsMatchIn(text) -> "export"
    else -> null
}

private fun extractDocComment(lines: List<String>, lineIdx: Int): String? {
    val comments = mutableListOf<String>()
    for (i in (lineIdx - 1) downTo maxOf(0, lineIdx - 15)) {
        val line = lines[i].trim()
        if (line.startsWith("*") || line.startsWith("/**") || line.startsWith("///") || line.startsWith("#")) {
            val cleaned = line.replace(Regex("^/\\*\\*|\\*/|\\*|///|#\\s?"), "").trim()
            comments.add(0, cleaned)
        } else if (line.isEmpty()) continue
        else break
    }
    return if (comments.isNotEmpty()) comments.joinToString(" ").take(500) else null
}

private fun deduplicate(symbols: List<Symbol>): List<Symbol> {
    val seen = mutableSetOf<String>()
    return symbols.filter { seen.add("${it.name}:${it.startLine}") }
}

// --- Pattern definitions ---

data class PatternDef(val regex: Regex, val kind: String, val nameGroup: Int)

private fun getPatterns(language: String): List<PatternDef> = when (language) {
    "typescript", "javascript" -> TS_PATTERNS
    "kotlin" -> KOTLIN_PATTERNS
    "python" -> PYTHON_PATTERNS
    "java" -> JAVA_PATTERNS
    "go" -> GO_PATTERNS
    "rust" -> RUST_PATTERNS
    "apex" -> APEX_PATTERNS
    else -> GENERIC_PATTERNS
}

private val TS_PATTERNS = listOf(
    PatternDef(Regex("^(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)", RegexOption.MULTILINE), "function", 1),
    PatternDef(Regex("^(?:export\\s+)?class\\s+(\\w+)", RegexOption.MULTILINE), "class", 1),
    PatternDef(Regex("^(?:export\\s+)?interface\\s+(\\w+)", RegexOption.MULTILINE), "interface", 1),
    PatternDef(Regex("^(?:export\\s+)?type\\s+(\\w+)", RegexOption.MULTILINE), "type", 1),
    PatternDef(Regex("^(?:export\\s+)?enum\\s+(\\w+)", RegexOption.MULTILINE), "enum", 1),
    PatternDef(Regex("^(?:export\\s+)?const\\s+(\\w+)\\s*=\\s*(?:async\\s*)?\\(", RegexOption.MULTILINE), "function", 1),
)

private val KOTLIN_PATTERNS = listOf(
    PatternDef(Regex("^\\s*(?:(?:public|private|internal|protected)\\s+)?(?:suspend\\s+)?fun\\s+(\\w+)", RegexOption.MULTILINE), "function", 1),
    PatternDef(Regex("^\\s*(?:(?:public|private|internal|protected)\\s+)?(?:data\\s+|sealed\\s+|abstract\\s+|open\\s+)?class\\s+(\\w+)", RegexOption.MULTILINE), "class", 1),
    PatternDef(Regex("^\\s*(?:(?:public|private|internal|protected)\\s+)?interface\\s+(\\w+)", RegexOption.MULTILINE), "interface", 1),
    PatternDef(Regex("^\\s*(?:(?:public|private|internal|protected)\\s+)?object\\s+(\\w+)", RegexOption.MULTILINE), "module", 1),
    PatternDef(Regex("^\\s*(?:(?:public|private|internal|protected)\\s+)?enum\\s+class\\s+(\\w+)", RegexOption.MULTILINE), "enum", 1),
)

private val PYTHON_PATTERNS = listOf(
    PatternDef(Regex("^\\s*(?:async\\s+)?def\\s+(\\w+)", RegexOption.MULTILINE), "function", 1),
    PatternDef(Regex("^class\\s+(\\w+)", RegexOption.MULTILINE), "class", 1),
)

private val JAVA_PATTERNS = listOf(
    PatternDef(Regex("^\\s*(?:(?:public|private|protected)\\s+)?(?:static\\s+)?(?:[\\w<>\\[\\]]+\\s+)(\\w+)\\s*\\(", RegexOption.MULTILINE), "function", 1),
    PatternDef(Regex("^\\s*(?:(?:public|private|protected)\\s+)?(?:abstract\\s+)?class\\s+(\\w+)", RegexOption.MULTILINE), "class", 1),
    PatternDef(Regex("^\\s*(?:(?:public|private|protected)\\s+)?interface\\s+(\\w+)", RegexOption.MULTILINE), "interface", 1),
    PatternDef(Regex("^\\s*(?:(?:public|private|protected)\\s+)?enum\\s+(\\w+)", RegexOption.MULTILINE), "enum", 1),
)

private val GO_PATTERNS = listOf(
    PatternDef(Regex("^func\\s+(?:\\(\\w+\\s+\\*?\\w+\\)\\s+)?(\\w+)", RegexOption.MULTILINE), "function", 1),
    PatternDef(Regex("^type\\s+(\\w+)\\s+struct", RegexOption.MULTILINE), "struct", 1),
    PatternDef(Regex("^type\\s+(\\w+)\\s+interface", RegexOption.MULTILINE), "interface", 1),
)

private val RUST_PATTERNS = listOf(
    PatternDef(Regex("^\\s*(?:pub\\s+)?(?:async\\s+)?fn\\s+(\\w+)", RegexOption.MULTILINE), "function", 1),
    PatternDef(Regex("^\\s*(?:pub\\s+)?struct\\s+(\\w+)", RegexOption.MULTILINE), "struct", 1),
    PatternDef(Regex("^\\s*(?:pub\\s+)?trait\\s+(\\w+)", RegexOption.MULTILINE), "trait", 1),
    PatternDef(Regex("^\\s*(?:pub\\s+)?enum\\s+(\\w+)", RegexOption.MULTILINE), "enum", 1),
    PatternDef(Regex("^\\s*(?:pub\\s+)?mod\\s+(\\w+)", RegexOption.MULTILINE), "module", 1),
)

private val APEX_PATTERNS = listOf(
    PatternDef(Regex("^\\s*(?:(?:public|private|protected|global)\\s+)?(?:(?:virtual|abstract|static|override)\\s+)*(?:\\w+\\s+)(\\w+)\\s*\\(", RegexOption.MULTILINE), "function", 1),
    PatternDef(Regex("^\\s*(?:(?:public|private|protected|global)\\s+)?(?:(?:virtual|abstract|with\\s+sharing|without\\s+sharing)\\s+)?class\\s+(\\w+)", RegexOption.MULTILINE), "class", 1),
    PatternDef(Regex("^\\s*(?:(?:public|global)\\s+)?interface\\s+(\\w+)", RegexOption.MULTILINE), "interface", 1),
    PatternDef(Regex("^\\s*(?:(?:public|global)\\s+)?enum\\s+(\\w+)", RegexOption.MULTILINE), "enum", 1),
    PatternDef(Regex("^\\s*trigger\\s+(\\w+)\\s+on", RegexOption.MULTILINE), "class", 1),
)

private val GENERIC_PATTERNS = listOf(
    PatternDef(Regex("^(?:function|def|func|fn|sub)\\s+(\\w+)", RegexOption.MULTILINE), "function", 1),
    PatternDef(Regex("^(?:class|struct|type)\\s+(\\w+)", RegexOption.MULTILINE), "class", 1),
)
