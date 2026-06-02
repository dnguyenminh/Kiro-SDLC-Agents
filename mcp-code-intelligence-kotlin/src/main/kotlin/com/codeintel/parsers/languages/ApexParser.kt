/**
 * KSA-191: Apex Language Parser — Regex-based extraction for .cls and .trigger files.
 * Extracts: classes, interfaces, enums, methods, fields, DML, SOQL, triggers, inheritance.
 */
package com.codeintel.parsers.languages

import com.codeintel.parsers.*

class ApexParser(languageId: String = "apex") : BaseLanguageParser(languageId) {

    override fun getSupportedExtensions() = listOf(".cls", ".trigger")

    override fun parse(source: String, filePath: String): ParseResult {
        val symbols = mutableListOf<ExtractedSymbol>()
        val rels = mutableListOf<ExtractedRelationship>()
        val lines = source.lines()

        if (filePath.endsWith(".trigger")) {
            extractTrigger(lines, source, filePath, symbols, rels)
        } else {
            extractDeclarations(lines, source, filePath, symbols, rels)
        }

        extractDML(lines, source, filePath, symbols, rels)
        extractSOQL(lines, source, filePath, symbols, rels)

        return ParseResult(symbols, rels)
    }

    private fun extractDeclarations(
        lines: List<String>, source: String, filePath: String,
        symbols: MutableList<ExtractedSymbol>,
        rels: MutableList<ExtractedRelationship>
    ) {
        var currentClass: String? = null
        for ((i, line) in lines.withIndex()) {
            val t = line.trim(); val ln = i + 1
            if (t.startsWith("//") || t.startsWith("/*")) continue

            CLASS_RE.find(t)?.let { m ->
                val name = m.groupValues[4]
                currentClass = name
                val mods = extractModifiers(m.groupValues[0])
                symbols.add(buildSymbol(name, "class", filePath, ln, ln,
                    "class $name", modifiers = mods,
                    isExported = isPublicOrGlobal(mods)))
                extractInheritance(t, name, filePath, ln, rels)
            }

            INTERFACE_RE.find(t)?.let { m ->
                val name = m.groupValues[3]
                currentClass = name
                symbols.add(buildSymbol(name, "interface", filePath, ln, ln,
                    "interface $name", isExported = true))
            }

            ENUM_RE.find(t)?.let { m ->
                val name = m.groupValues[3]
                symbols.add(buildSymbol(name, "enum", filePath, ln, ln,
                    "enum $name", isExported = true))
            }

            METHOD_RE.find(t)?.let { m ->
                val returnType = m.groupValues[2].takeIf { it.isNotBlank() }
                val name = m.groupValues[3]
                val params = m.groupValues[4]
                val mods = extractModifiers(m.groupValues[0])
                val decorators = extractAnnotations(lines, i)
                symbols.add(buildSymbol(name, "method", filePath, ln, ln,
                    "$name($params)", parameters = "($params)",
                    returnType = returnType, modifiers = mods,
                    decorators = decorators, parentName = currentClass,
                    isExported = isPublicOrGlobal(mods)))
                extractCalls(t, currentClass ?: name, filePath, ln, rels)
            }
        }
    }

    private fun extractTrigger(
        lines: List<String>, source: String, filePath: String,
        symbols: MutableList<ExtractedSymbol>,
        rels: MutableList<ExtractedRelationship>
    ) {
        for ((i, line) in lines.withIndex()) {
            val t = line.trim(); val ln = i + 1
            TRIGGER_RE.find(t)?.let { m ->
                val name = m.groupValues[1]
                val sobject = m.groupValues[2]
                val events = m.groupValues[3]
                symbols.add(buildSymbol(name, "class", filePath, ln, ln,
                    "trigger $name on $sobject ($events)",
                    modifiers = listOf("trigger"), isExported = true))
                rels.add(buildRelationship(name, sobject, "trigger-on",
                    filePath, ln, mapOf("events" to events)))
            }
        }
    }

    private fun extractInheritance(
        line: String, className: String, filePath: String,
        ln: Int, rels: MutableList<ExtractedRelationship>
    ) {
        EXTENDS_RE.find(line)?.let { m ->
            rels.add(buildRelationship(className, m.groupValues[1],
                "inherits", filePath, ln))
        }
        IMPLEMENTS_RE.find(line)?.let { m ->
            m.groupValues[1].split(",").map { it.trim() }
                .filter { it.isNotBlank() }.forEach { iface ->
                    rels.add(buildRelationship(className, iface,
                        "implements", filePath, ln))
                }
        }
    }

    private fun extractCalls(
        line: String, caller: String, filePath: String,
        ln: Int, rels: MutableList<ExtractedRelationship>
    ) {
        CALL_RE.findAll(line).forEach { m ->
            val target = m.groupValues[1]
            if (target !in APEX_KEYWORDS && target.first().isUpperCase()) {
                rels.add(buildRelationship(caller, target, "calls", filePath, ln))
            }
        }
    }

    private fun extractDML(
        lines: List<String>, source: String, filePath: String,
        symbols: List<ExtractedSymbol>,
        rels: MutableList<ExtractedRelationship>
    ) {
        val caller = symbols.firstOrNull { it.kind == "class" }?.name ?: "__file__"
        for ((i, line) in lines.withIndex()) {
            DML_RE.find(line.trim())?.let { m ->
                val op = m.groupValues[1].uppercase()
                val target = m.groupValues[2]
                rels.add(buildRelationship(caller, target, "dml",
                    filePath, i + 1, mapOf("operation" to op)))
            }
        }
    }

    private fun extractSOQL(
        lines: List<String>, source: String, filePath: String,
        symbols: List<ExtractedSymbol>,
        rels: MutableList<ExtractedRelationship>
    ) {
        val caller = symbols.firstOrNull { it.kind == "class" }?.name ?: "__file__"
        SOQL_RE.findAll(source).forEach { m ->
            val sobject = m.groupValues[1]
            val ln = source.substring(0, m.range.first).count { it == '\n' } + 1
            rels.add(buildRelationship(caller, sobject, "soql", filePath, ln))
        }
    }

    private fun extractModifiers(text: String): List<String>? {
        val mods = APEX_MODIFIERS.filter { mod ->
            Regex("\\b${Regex.escape(mod)}\\b", RegexOption.IGNORE_CASE)
                .containsMatchIn(text)
        }
        return mods.takeIf { it.isNotEmpty() }
    }

    private fun extractAnnotations(lines: List<String>, lineIdx: Int): List<String>? {
        val annotations = mutableListOf<String>()
        for (i in (lineIdx - 1) downTo maxOf(0, lineIdx - 5)) {
            val t = lines[i].trim()
            if (t.startsWith("@")) {
                annotations.add(0, t.substringBefore("(").substringBefore(" "))
            } else if (t.isNotEmpty() && !t.startsWith("//") && !t.startsWith("*")) break
        }
        return annotations.takeIf { it.isNotEmpty() }
    }

    private fun isPublicOrGlobal(mods: List<String>?): Boolean =
        mods != null && ("public" in mods || "global" in mods)

    companion object {
        private val CLASS_RE = Regex(
            """(public|private|protected|global)?\s*(virtual|abstract|with\s+sharing|without\s+sharing|inherited\s+sharing)?\s*(with\s+sharing|without\s+sharing)?\s*class\s+(\w+)""",
            RegexOption.IGNORE_CASE)
        private val INTERFACE_RE = Regex(
            """(public|global)?\s*(virtual)?\s*interface\s+(\w+)""", RegexOption.IGNORE_CASE)
        private val ENUM_RE = Regex(
            """(public|global)?\s*(virtual)?\s*enum\s+(\w+)""", RegexOption.IGNORE_CASE)
        private val METHOD_RE = Regex(
            """(public|private|protected|global|static|virtual|override|abstract|testmethod)\s+.*?([\w<>\[\],\s]+?)\s+(\w+)\s*\(([^)]*)\)""",
            RegexOption.IGNORE_CASE)
        private val TRIGGER_RE = Regex(
            """trigger\s+(\w+)\s+on\s+(\w+)\s*\(([^)]+)\)""", RegexOption.IGNORE_CASE)
        private val EXTENDS_RE = Regex("""extends\s+(\w+)""", RegexOption.IGNORE_CASE)
        private val IMPLEMENTS_RE = Regex("""implements\s+([\w\s,]+)""", RegexOption.IGNORE_CASE)
        private val DML_RE = Regex(
            """(insert|update|delete|upsert|undelete|merge)\s+(\w+)""", RegexOption.IGNORE_CASE)
        private val SOQL_RE = Regex("""FROM\s+(\w+)""", RegexOption.IGNORE_CASE)
        private val CALL_RE = Regex("""(\w+)\s*\(""")
        private val APEX_KEYWORDS = setOf(
            "if", "else", "for", "while", "do", "switch", "when", "return",
            "try", "catch", "finally", "throw", "new", "this", "super",
            "insert", "update", "delete", "upsert", "undelete", "merge")
        private val APEX_MODIFIERS = listOf(
            "public", "private", "protected", "global", "virtual", "abstract",
            "static", "final", "transient", "webservice", "override", "testmethod")
    }
}
