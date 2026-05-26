/**
 * KSA-172: Grammar Registry — Manages tree-sitter grammar loading and caching.
 */
package com.codeintel.parsers

data class LanguageConfig(
    val id: String,
    val extensions: List<String>,
    val grammarPath: String,
    val parserClass: String,
)

data class GrammarRegistryConfig(
    val languages: List<LanguageConfig> = emptyList(),
    val grammarDir: String = "",
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
        val ext = ".${filePath.substringAfterLast('.', "")}"
        val langId = extensionMap[ext] ?: return null
        if (langId in unavailable) return null
        return languageParsers[langId] ?: loadParser(langId)
    }

    fun getLanguageId(filePath: String): String? {
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
        for (lang in config.languages) {
            for (ext in lang.extensions) { extensionMap[ext] = lang.id }
        }
    }
}
