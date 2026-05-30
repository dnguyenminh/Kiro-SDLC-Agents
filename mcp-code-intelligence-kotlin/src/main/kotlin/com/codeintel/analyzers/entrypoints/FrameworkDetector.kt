/**
 * KSA-162: Framework Detector — Identifies frameworks from import statements.
 */
package com.codeintel.analyzers.entrypoints

class FrameworkDetector(private val registry: PatternRegistry) {

    fun detect(source: String, language: String): FrameworkInfo? {
        val frameworks = registry.getFrameworksForLanguage(language)
        if (frameworks.isEmpty()) return null

        var bestMatch: Pair<String, Int>? = null
        for ((name, patterns) in frameworks) {
            val score = patterns.imports.count { source.contains(it) }
            if (score > 0 && (bestMatch == null || score > bestMatch.second)) {
                bestMatch = name to score
            }
        }
        if (bestMatch == null) return null
        val confidence = if (bestMatch.second >= 2) Confidence.High else Confidence.Medium
        return FrameworkInfo(bestMatch.first, language, confidence)
    }

    fun detectFromImports(imports: List<String>, language: String): FrameworkInfo? {
        val frameworks = registry.getFrameworksForLanguage(language)
        for ((name, patterns) in frameworks) {
            for (importPattern in patterns.imports) {
                if (imports.any { it.contains(importPattern) }) {
                    return FrameworkInfo(name, language, Confidence.High)
                }
            }
        }
        return null
    }
}
