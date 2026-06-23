/**
 * KSA-162: Entry Point Detector — Main orchestrator.
 */
package com.codeintel.analyzers.entrypoints

import com.codeintel.analyzers.entrypoints.detectors.*
import java.sql.Connection

class EntryPointDetector(private val conn: Connection) {
    private val registry = PatternRegistry()
    private val frameworkDetector = FrameworkDetector(registry)
    private val httpDetector = HTTPHandlerDetector(registry)
    private val mainDetector = MainDetector(registry)
    private val cliDetector = CLIDetector()
    private val eventDetector = EventDetector()
    private val store = EntryPointStore(conn)

    fun detectFile(filePath: String, source: String, language: String, symbols: List<SymbolInput>): List<EntryPoint> {
        val all = mutableListOf<EntryPoint>()
        val framework = frameworkDetector.detect(source, language)
        if (framework != null) {
            all.addAll(httpDetector.detectFromSymbols(symbols, framework.name, source))
        }
        all.addAll(mainDetector.detect(symbols, source, language))
        all.addAll(cliDetector.detect(symbols, source))
        all.addAll(eventDetector.detect(symbols, source))
        if (all.isNotEmpty()) store.upsertBatch(all)
        return all
    }

    fun query(filters: EntryPointFilters): EntryPointQueryResult = store.query(filters)
}
