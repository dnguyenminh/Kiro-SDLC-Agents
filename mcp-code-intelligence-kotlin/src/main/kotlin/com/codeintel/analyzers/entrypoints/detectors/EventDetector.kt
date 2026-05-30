/**
 * KSA-162: Event/MQ/Scheduled Handler Detector.
 */
package com.codeintel.analyzers.entrypoints.detectors

import com.codeintel.analyzers.entrypoints.*

private data class EventIndicator(val pattern: String, val type: EntryType)

private val EVENT_INDICATORS = listOf(
    EventIndicator("@EventHandler", EntryType.EVENT_HANDLER),
    EventIndicator("@Scheduled", EntryType.SCHEDULED),
    EventIndicator("@Cron", EntryType.SCHEDULED),
    EventIndicator("on_event", EntryType.EVENT_HANDLER),
    EventIndicator(".on(", EntryType.EVENT_HANDLER),
    EventIndicator(".subscribe(", EntryType.EVENT_HANDLER),
    EventIndicator("@RabbitListener", EntryType.EVENT_HANDLER),
    EventIndicator("@KafkaListener", EntryType.EVENT_HANDLER),
    EventIndicator("@SqsListener", EntryType.EVENT_HANDLER),
    EventIndicator("setInterval", EntryType.SCHEDULED),
    EventIndicator("cron.schedule", EntryType.SCHEDULED),
)

class EventDetector {

    fun detect(symbols: List<SymbolInput>, source: String): List<EntryPoint> {
        val results = mutableListOf<EntryPoint>()
        for (sym in symbols) {
            val decorators = sym.decorators ?: emptyList()
            val ctx = getContext(source, sym.startLine)
            for (indicator in EVENT_INDICATORS) {
                val found = decorators.any { it.contains(indicator.pattern) } ||
                    ctx.contains(indicator.pattern)
                if (found) {
                    val eventName = extractEventName(decorators, ctx, indicator.pattern)
                    results.add(EntryPoint(
                        symbolId = sym.id, symbolName = sym.name,
                        filePath = sym.filePath, startLine = sym.startLine,
                        entryType = indicator.type,
                        eventName = eventName ?: sym.name,
                        confidence = Confidence.Medium,
                    ))
                    break
                }
            }
        }
        return results
    }

    private fun extractEventName(decorators: List<String>, context: String, pattern: String): String? {
        for (dec in decorators) {
            if (dec.contains(pattern)) {
                val match = Regex("['\"`]([^'\"`]+)['\"`]").find(dec)
                if (match != null) return match.groupValues[1]
            }
        }
        val idx = context.indexOf(pattern)
        if (idx >= 0) {
            val after = context.substring(idx + pattern.length)
            val match = Regex("['\"`]([^'\"`]+)['\"`]").find(after)
            if (match != null) return match.groupValues[1]
        }
        return null
    }

    private fun getContext(source: String, startLine: Int): String {
        val lines = source.split("\n")
        val start = maxOf(0, startLine - 2)
        val end = minOf(lines.size, startLine + 3)
        return lines.subList(start, end).joinToString("\n")
    }
}
