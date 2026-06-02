/**
 * KSA-172: Grammar Registry — Manages tree-sitter grammar loading and caching.
 */
package com.codeintel.parsers

data class LanguageConfig(
    val id: String,
    val extensions: List<String>,
    val grammarPath: String?,
    val parserClass: String,
)

data class GrammarRegistryConfig(
    val languages: List<LanguageConfig> = DEFAULT_LANGUAGE_CONFIGS,
    val grammarDir: String = "",
)

/** Default language configurations including Salesforce support. */
val DEFAULT_LANGUAGE_CONFIGS = listOf(
    LanguageConfig("apex", listOf(".cls", ".trigger"),
        null, "com.codeintel.parsers.languages.ApexParser"),
    LanguageConfig("salesforce-meta",
        listOf(".flow-meta.xml", ".object-meta.xml", ".field-meta.xml",
            ".js-meta.xml", ".component-meta.xml"),
        null, "com.codeintel.parsers.languages.SalesforceMetaParser"),
    LanguageConfig("typescript", listOf(".ts", ".tsx"),
        null, "com.codeintel.parsers.languages.TypeScriptParser"),
    LanguageConfig("java", listOf(".java"),
        null, "com.codeintel.parsers.languages.JavaParser"),
    LanguageConfig("kotlin", listOf(".kt", ".kts"),
        null, "com.codeintel.parsers.languages.KotlinLangParser"),
    LanguageConfig("python", listOf(".py", ".pyi"),
        null, "com.codeintel.parsers.languages.PythonParser"),
    LanguageConfig("go", listOf(".go"),
        null, "com.codeintel.parsers.languages.GoParser"),
    LanguageConfig("rust", listOf(".rs"),
        null, "com.codeintel.parsers.languages.RustParser"),
    LanguageConfig("csharp", listOf(".cs"),
        null, "com.codeintel.parsers.languages.CSharpParser"),
    LanguageConfig("ruby", listOf(".rb", ".rake"),
        null, "com.codeintel.parsers.languages.RubyParser"),
    LanguageConfig("php", listOf(".php"),
        null, "com.codeintel.parsers.languages.PhpParser"),
    LanguageConfig("swift", listOf(".swift"),
        null, "com.codeintel.parsers.languages.SwiftParser"),
    LanguageConfig("scala", listOf(".scala", ".sc"),
        null, "com.codeintel.parsers.languages.ScalaParser"),
)

class GrammarRegistry(private val config: GrammarRegistryConfig) {
    private val languageParsers = mutableMapOf<String, ILanguageParser>()
    private val extensionMap = mutableMapOf<String, String>()
    private val unavailable = mutableSetOf<String>()
    private var initialized = false

    init { buildExtensionMap() }

    fun initialize() { if (initialized) return; initialized = true }

    fun getParser(filePath: String): ILanguageParser? {
        if (!initialized) initialize()
        val langId = getLanguageId(filePath) ?: return null
        if (langId in unavailable) return null
        return languageParsers[langId] ?: loadParser(langId)
    }

    fun getLanguageId(filePath: String): String? {
        val lowerPath = filePath.lowercase()
        // Try compound extensions first (longest match wins)
        for ((ext, langId) in extensionMap) {
            if (ext.count { it == '.' } > 1 && lowerPath.endsWith(ext)) {
                return langId
            }
        }
        // Fall back to simple extension
        val ext = ".${filePath.substringAfterLast('.', "")}"
        return extensionMap[ext]
    }

    fun registerParser(langId: String, parser: ILanguageParser) {
        languageParsers[langId] = parser
    }

    fun isAvailable(langId: String): Boolean =
        langId !in unavailable && config.languages.any { it.id == langId }

    private fun loadParser(langId: String): ILanguageParser? {
        val langConfig = config.languages.find { it.id == langId } ?: return null
        return try {
            val cls = Class.forName(langConfig.parserClass)
            val parser = cls.getDeclaredConstructor(String::class.java).newInstance(langId) as ILanguageParser
            languageParsers[langId] = parser
            parser
        } catch (e: Exception) {
            System.err.println("[grammar-registry] Failed to load $langId: ${e.message}")
            unavailable.add(langId)
            null
        }
    }

    private fun buildExtensionMap() {
        // Sort by extension length descending so compound extensions match first
        val sorted = config.languages.flatMap { lang ->
            lang.extensions.map { ext -> ext to lang.id }
        }.sortedByDescending { it.first.length }
        for ((ext, langId) in sorted) {
            extensionMap[ext] = langId
        }
    }
}
