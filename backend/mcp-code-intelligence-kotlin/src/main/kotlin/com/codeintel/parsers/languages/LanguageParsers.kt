/**
 * KSA-172: All Language Parsers — Regex-based extraction.
 * Supports: Python, Java, Kotlin, Go, Rust, C#, Ruby, PHP, Swift, Scala.
 */
package com.codeintel.parsers.languages

import com.codeintel.parsers.*

class PythonParser(languageId: String = "python") : BaseLanguageParser(languageId) {
    override fun getSupportedExtensions() = listOf(".py", ".pyi")
    override fun parse(source: String, filePath: String): ParseResult {
        val symbols = mutableListOf<ExtractedSymbol>()
        val rels = mutableListOf<ExtractedRelationship>()
        val defRe = Regex("""^(\s*)(async\s+)?def\s+(\w+)\s*\(([^)]*)\)""")
        val classRe = Regex("""^(\s*)class\s+(\w+)(?:\(([^)]*)\))?""")
        val importRe = Regex("""^(?:from\s+([\w.]+)\s+)?import\s+(.+)""")
        for ((i, line) in source.lines().withIndex()) {
            val ln = i + 1
            importRe.find(line.trim())?.let { m ->
                val mod = m.groupValues[1]; val names = m.groupValues[2].split(",").map { it.trim().split(" as ")[0].trim() }
                for (n in names) rels.add(buildRelationship("__file__", if (mod.isNotEmpty()) "$mod.$n" else n, "imports", filePath, ln))
            }
            defRe.find(line)?.let { m -> symbols.add(buildSymbol(m.groupValues[3], "function", filePath, ln, ln, "${if (m.groupValues[2].isNotBlank()) "async " else ""}def ${m.groupValues[3]}(${m.groupValues[4]})", parameters="(${m.groupValues[4]})", isAsync=m.groupValues[2].isNotBlank(), isExported=!m.groupValues[3].startsWith("_"))) }
            classRe.find(line)?.let { m ->
                symbols.add(buildSymbol(m.groupValues[2], "class", filePath, ln, ln, "class ${m.groupValues[2]}", isExported=!m.groupValues[2].startsWith("_")))
                m.groupValues[3].takeIf { it.isNotBlank() }?.split(",")?.map { it.trim() }?.forEach { base -> rels.add(buildRelationship(m.groupValues[2], base, "inherits", filePath, ln)) }
            }
        }
        return ParseResult(symbols, rels)
    }
}

class JavaParser(languageId: String = "java") : BaseLanguageParser(languageId) {
    override fun getSupportedExtensions() = listOf(".java")
    override fun parse(source: String, filePath: String): ParseResult {
        val symbols = mutableListOf<ExtractedSymbol>()
        val rels = mutableListOf<ExtractedRelationship>()
        val classRe = Regex("""(public|private|protected)?\s*(abstract|final)?\s*(class|interface|enum|record)\s+(\w+)""")
        val importRe = Regex("""^import\s+(static\s+)?([\w.*]+)""")
        val pkgRe = Regex("""^package\s+([\w.]+)""")
        for ((i, line) in source.lines().withIndex()) {
            val t = line.trim(); val ln = i + 1
            pkgRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[1], "namespace", filePath, ln, ln, "package ${m.groupValues[1]}")) }
            importRe.find(t)?.let { m -> rels.add(buildRelationship("__file__", m.groupValues[2], "imports", filePath, ln)) }
            classRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[4], m.groupValues[3], filePath, ln, ln, "${m.groupValues[3]} ${m.groupValues[4]}", isExported=m.groupValues[1]=="public")) }
        }
        return ParseResult(symbols, rels)
    }
}

class KotlinLangParser(languageId: String = "kotlin") : BaseLanguageParser(languageId) {
    override fun getSupportedExtensions() = listOf(".kt", ".kts")
    override fun parse(source: String, filePath: String): ParseResult {
        val symbols = mutableListOf<ExtractedSymbol>()
        val rels = mutableListOf<ExtractedRelationship>()
        val funRe = Regex("""(suspend\s+)?fun\s+(?:(\w+)\.)?(\w+)\s*\(""")
        val classRe = Regex("""(data\s+|sealed\s+|abstract\s+|open\s+)?(class|interface|object|enum\s+class)\s+(\w+)""")
        val importRe = Regex("""^import\s+([\w.]+)(\.\*)?""")
        val pkgRe = Regex("""^package\s+([\w.]+)""")
        for ((i, line) in source.lines().withIndex()) {
            val t = line.trim(); val ln = i + 1
            pkgRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[1], "namespace", filePath, ln, ln, "package ${m.groupValues[1]}")) }
            importRe.find(t)?.let { m -> rels.add(buildRelationship("__file__", m.groupValues[1] + if (m.groupValues[2].isNotBlank()) ".*" else "", "imports", filePath, ln)) }
            funRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[3], "function", filePath, ln, ln, "fun ${m.groupValues[3]}()", isAsync=m.groupValues[1].isNotBlank(), isExported=true)) }
            classRe.find(t)?.let { m ->
                val kind = when { m.groupValues[2] == "interface" -> "interface"; m.groupValues[2].contains("enum") -> "enum"; else -> "class" }
                symbols.add(buildSymbol(m.groupValues[3], kind, filePath, ln, ln, "${m.groupValues[2]} ${m.groupValues[3]}", isExported=true))
            }
        }
        return ParseResult(symbols, rels)
    }
}

class GoParser(languageId: String = "go") : BaseLanguageParser(languageId) {
    override fun getSupportedExtensions() = listOf(".go")
    override fun parse(source: String, filePath: String): ParseResult {
        val symbols = mutableListOf<ExtractedSymbol>()
        val rels = mutableListOf<ExtractedRelationship>()
        val funcRe = Regex("""^func\s+(\(\w+\s+\*?(\w+)\)\s+)?(\w+)\s*\(""")
        val typeRe = Regex("""^type\s+(\w+)\s+(struct|interface)""")
        for ((i, line) in source.lines().withIndex()) {
            val t = line.trim(); val ln = i + 1
            funcRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[3], if (m.groupValues[2].isNotBlank()) "method" else "function", filePath, ln, ln, "func ${m.groupValues[3]}()", parentName=m.groupValues[2].takeIf { it.isNotBlank() }, isExported=m.groupValues[3][0].isUpperCase())) }
            typeRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[1], if (m.groupValues[2]=="interface") "interface" else "struct", filePath, ln, ln, "type ${m.groupValues[1]} ${m.groupValues[2]}", isExported=m.groupValues[1][0].isUpperCase())) }
        }
        return ParseResult(symbols, rels)
    }
}

class RustParser(languageId: String = "rust") : BaseLanguageParser(languageId) {
    override fun getSupportedExtensions() = listOf(".rs")
    override fun parse(source: String, filePath: String): ParseResult {
        val symbols = mutableListOf<ExtractedSymbol>()
        val rels = mutableListOf<ExtractedRelationship>()
        val fnRe = Regex("""^(pub\s+)?(async\s+)?fn\s+(\w+)""")
        val structRe = Regex("""^(pub\s+)?struct\s+(\w+)""")
        val enumRe = Regex("""^(pub\s+)?enum\s+(\w+)""")
        val traitRe = Regex("""^(pub\s+)?trait\s+(\w+)""")
        val implRe = Regex("""^impl\s+(?:(\w+)\s+for\s+)?(\w+)""")
        val useRe = Regex("""^(pub\s+)?use\s+([\w:]+)""")
        for ((i, line) in source.lines().withIndex()) {
            val t = line.trim(); val ln = i + 1
            fnRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[3], "function", filePath, ln, ln, "fn ${m.groupValues[3]}", isAsync=m.groupValues[2].isNotBlank(), isExported=m.groupValues[1].isNotBlank())) }
            structRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[2], "struct", filePath, ln, ln, "struct ${m.groupValues[2]}", isExported=m.groupValues[1].isNotBlank())) }
            enumRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[2], "enum", filePath, ln, ln, "enum ${m.groupValues[2]}", isExported=m.groupValues[1].isNotBlank())) }
            traitRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[2], "trait", filePath, ln, ln, "trait ${m.groupValues[2]}", isExported=m.groupValues[1].isNotBlank())) }
            implRe.find(t)?.let { m -> m.groupValues[1].takeIf { it.isNotBlank() }?.let { trait -> rels.add(buildRelationship(m.groupValues[2], trait, "implements", filePath, ln)) } }
            useRe.find(t)?.let { m -> rels.add(buildRelationship(filePath, m.groupValues[2], "imports", filePath, ln)) }
        }
        return ParseResult(symbols, rels)
    }
}

class CSharpParser(languageId: String = "csharp") : BaseLanguageParser(languageId) {
    override fun getSupportedExtensions() = listOf(".cs")
    override fun parse(source: String, filePath: String): ParseResult {
        val symbols = mutableListOf<ExtractedSymbol>()
        val rels = mutableListOf<ExtractedRelationship>()
        val classRe = Regex("""(public|internal)?\s*(abstract|sealed|static)?\s*(class|interface|struct|enum|record)\s+(\w+)""")
        val usingRe = Regex("""^using\s+([\w.]+)""")
        for ((i, line) in source.lines().withIndex()) {
            val t = line.trim(); val ln = i + 1
            usingRe.find(t)?.let { m -> rels.add(buildRelationship("__file__", m.groupValues[1], "imports", filePath, ln)) }
            classRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[4], m.groupValues[3], filePath, ln, ln, "${m.groupValues[3]} ${m.groupValues[4]}", isExported=m.groupValues[1]=="public")) }
        }
        return ParseResult(symbols, rels)
    }
}

class RubyParser(languageId: String = "ruby") : BaseLanguageParser(languageId) {
    override fun getSupportedExtensions() = listOf(".rb", ".rake")
    override fun parse(source: String, filePath: String): ParseResult {
        val symbols = mutableListOf<ExtractedSymbol>()
        val rels = mutableListOf<ExtractedRelationship>()
        val defRe = Regex("""^def\s+(self\.)?(\w+[?!=]?)""")
        val classRe = Regex("""^class\s+(\w+)(?:\s*<\s*(\w+))?""")
        val moduleRe = Regex("""^module\s+(\w+)""")
        val requireRe = Regex("""^require(?:_relative)?\s+['"]([^'"]+)""")
        for ((i, line) in source.lines().withIndex()) {
            val t = line.trim(); val ln = i + 1
            requireRe.find(t)?.let { m -> rels.add(buildRelationship("__file__", m.groupValues[1], "imports", filePath, ln)) }
            defRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[2], "method", filePath, ln, ln, "def ${m.groupValues[1]}${m.groupValues[2]}", isExported=!m.groupValues[2].startsWith("_"))) }
            classRe.find(t)?.let { m ->
                symbols.add(buildSymbol(m.groupValues[1], "class", filePath, ln, ln, "class ${m.groupValues[1]}", isExported=true))
                m.groupValues[2].takeIf { it.isNotBlank() }?.let { base -> rels.add(buildRelationship(m.groupValues[1], base, "inherits", filePath, ln)) }
            }
            moduleRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[1], "module", filePath, ln, ln, "module ${m.groupValues[1]}", isExported=true)) }
        }
        return ParseResult(symbols, rels)
    }
}

class PhpParser(languageId: String = "php") : BaseLanguageParser(languageId) {
    override fun getSupportedExtensions() = listOf(".php")
    override fun parse(source: String, filePath: String): ParseResult {
        val symbols = mutableListOf<ExtractedSymbol>()
        val rels = mutableListOf<ExtractedRelationship>()
        val funcRe = Regex("""function\s+(\w+)\s*\(""")
        val classRe = Regex("""(abstract\s+)?(class|interface|trait)\s+(\w+)""")
        val useRe = Regex("""^use\s+([\w\\]+)""")
        val nsRe = Regex("""^namespace\s+([\w\\]+)""")
        for ((i, line) in source.lines().withIndex()) {
            val t = line.trim(); val ln = i + 1
            nsRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[1], "namespace", filePath, ln, ln, "namespace ${m.groupValues[1]}")) }
            useRe.find(t)?.let { m -> rels.add(buildRelationship("__file__", m.groupValues[1], "imports", filePath, ln)) }
            classRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[3], m.groupValues[2], filePath, ln, ln, "${m.groupValues[2]} ${m.groupValues[3]}", isExported=true)) }
            funcRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[1], if (m.groupValues[1]=="__construct") "constructor" else "method", filePath, ln, ln, "function ${m.groupValues[1]}()", isExported=true)) }
        }
        return ParseResult(symbols, rels)
    }
}

class SwiftParser(languageId: String = "swift") : BaseLanguageParser(languageId) {
    override fun getSupportedExtensions() = listOf(".swift")
    override fun parse(source: String, filePath: String): ParseResult {
        val symbols = mutableListOf<ExtractedSymbol>()
        val rels = mutableListOf<ExtractedRelationship>()
        val funcRe = Regex("""func\s+(\w+)\s*\(""")
        val classRe = Regex("""(class|struct|protocol|enum)\s+(\w+)""")
        val importRe = Regex("""^import\s+(\w+)""")
        for ((i, line) in source.lines().withIndex()) {
            val t = line.trim(); val ln = i + 1
            importRe.find(t)?.let { m -> rels.add(buildRelationship("__file__", m.groupValues[1], "imports", filePath, ln)) }
            funcRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[1], "function", filePath, ln, ln, "func ${m.groupValues[1]}()", isExported=true)) }
            classRe.find(t)?.let { m ->
                val kind = when(m.groupValues[1]) { "protocol"->"interface"; "struct"->"struct"; "enum"->"enum"; else->"class" }
                symbols.add(buildSymbol(m.groupValues[2], kind, filePath, ln, ln, "${m.groupValues[1]} ${m.groupValues[2]}", isExported=true))
            }
        }
        return ParseResult(symbols, rels)
    }
}

class ScalaParser(languageId: String = "scala") : BaseLanguageParser(languageId) {
    override fun getSupportedExtensions() = listOf(".scala", ".sc")
    override fun parse(source: String, filePath: String): ParseResult {
        val symbols = mutableListOf<ExtractedSymbol>()
        val rels = mutableListOf<ExtractedRelationship>()
        val defRe = Regex("""def\s+(\w+)""")
        val classRe = Regex("""(case\s+)?(class|object|trait)\s+(\w+)""")
        val importRe = Regex("""^import\s+([\w.]+)""")
        val pkgRe = Regex("""^package\s+([\w.]+)""")
        for ((i, line) in source.lines().withIndex()) {
            val t = line.trim(); val ln = i + 1
            pkgRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[1], "namespace", filePath, ln, ln, "package ${m.groupValues[1]}")) }
            importRe.find(t)?.let { m -> rels.add(buildRelationship("__file__", m.groupValues[1], "imports", filePath, ln)) }
            defRe.find(t)?.let { m -> symbols.add(buildSymbol(m.groupValues[1], "function", filePath, ln, ln, "def ${m.groupValues[1]}", isExported=true)) }
            classRe.find(t)?.let { m ->
                val kind = when(m.groupValues[2]) { "trait"->"trait"; "object"->"class"; else->"class" }
                symbols.add(buildSymbol(m.groupValues[3], kind, filePath, ln, ln, "${m.groupValues[2]} ${m.groupValues[3]}", isExported=true))
            }
        }
        return ParseResult(symbols, rels)
    }
}
