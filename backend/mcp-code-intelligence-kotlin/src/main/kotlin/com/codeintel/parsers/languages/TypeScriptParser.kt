/**
 * KSA-172: TypeScript/JavaScript Language Parser.
 * Regex-based extraction matching nodejs tree-sitter output structure.
 */
package com.codeintel.parsers.languages

import com.codeintel.parsers.*

class TypeScriptParser(languageId: String = "typescript") : BaseLanguageParser(languageId) {
    override fun getSupportedExtensions(): List<String> =
        if (languageId == "typescript") listOf(".ts", ".tsx") else listOf(".js", ".jsx", ".mjs", ".cjs")

    override fun parse(source: String, filePath: String): ParseResult {
        val symbols = mutableListOf<ExtractedSymbol>()
        val rels = mutableListOf<ExtractedRelationship>()
        val lines = source.lines()
        val importRe = Regex("""import\s+.*?from\s+['"]([^'"]+)['"]""")
        val funcRe = Regex("""^(export\s+)?(async\s+)?function\s*\*?\s+(\w+)\s*\(([^)]*)\)""")
        val classRe = Regex("""^(export\s+)?(abstract\s+)?class\s+(\w+)""")
        val ifaceRe = Regex("""^(export\s+)?interface\s+(\w+)""")
        val enumRe = Regex("""^(export\s+)?enum\s+(\w+)""")
        for ((i, line) in lines.withIndex()) {
            val t = line.trim(); val ln = i + 1
            importRe.find(t)?.let { rels.add(buildRelationship("__file__", it.groupValues[1], "imports", filePath, ln)) }
            funcRe.find(t)?.let { m ->
                symbols.add(buildSymbol(m.groupValues[3], "function", filePath, ln, ln, "${if (m.groupValues[2].isNotBlank()) "async " else ""}function ${m.groupValues[3]}(${m.groupValues[4]})", parameters="(${m.groupValues[4]})", isAsync=m.groupValues[2].isNotBlank(), isExported=m.groupValues[1].isNotBlank()))
            }
            classRe.find(t)?.let { m ->
                symbols.add(buildSymbol(m.groupValues[3], "class", filePath, ln, ln, "${if (m.groupValues[2].isNotBlank()) "abstract " else ""}class ${m.groupValues[3]}", modifiers=if (m.groupValues[2].isNotBlank()) listOf("abstract") else null, isExported=m.groupValues[1].isNotBlank()))
            }
            ifaceRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[2], "interface", filePath, ln, ln, "interface ${m.groupValues[2]}", isExported=m.groupValues[1].isNotBlank())) }
            enumRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[2], "enum", filePath, ln, ln, "enum ${m.groupValues[2]}", isExported=m.groupValues[1].isNotBlank())) }
        }
        return ParseResult(symbols, rels)
    }
}
