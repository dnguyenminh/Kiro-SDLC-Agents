/**
 * KSA-162: Main Function Detector.
 */
package com.codeintel.analyzers.entrypoints.detectors

import com.codeintel.analyzers.entrypoints.*

class MainDetector(private val registry: PatternRegistry) {

    fun detect(symbols: List<SymbolInput>, source: String, language: String): List<EntryPoint> {
        val mainPattern = registry.getMainPattern(language) ?: return emptyList()
        val results = mutableListOf<EntryPoint>()

        for (sym in symbols) {
            if (sym.name == "main" || sym.name == "__main__") {
                results.add(createEntryPoint(sym))
            }
        }

        if (results.isEmpty() && source.contains(mainPattern.first)) {
            val lines = source.split("\n")
            val patternLine = lines.indexOfFirst { it.contains(mainPattern.first) }
            if (patternLine >= 0) {
                val closest = symbols.minByOrNull {
                    kotlin.math.abs(it.startLine - patternLine)
                }
                if (closest != null) results.add(createEntryPoint(closest))
            }
        }
        return results
    }

    private fun createEntryPoint(sym: SymbolInput) = EntryPoint(
        symbolId = sym.id, symbolName = sym.name,
        filePath = sym.filePath, startLine = sym.startLine,
        entryType = EntryType.MAIN, confidence = Confidence.High,
    )
}
