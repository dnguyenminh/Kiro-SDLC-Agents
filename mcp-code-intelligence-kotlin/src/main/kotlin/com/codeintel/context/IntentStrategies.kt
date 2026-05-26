/** Intent Strategies — maps intent to prioritized section list. KSA-171. */
package com.codeintel.context

data class SectionDef(val name: String, val priority: Int, val format: String)

data class IntentStrategy(val intent: String, val sections: List<SectionDef>)

private val STRATEGIES = mapOf(
    "explain" to IntentStrategy("explain", listOf(
        SectionDef("source", 1, "full"),
        SectionDef("doc_comment", 2, "full"),
        SectionDef("siblings", 3, "signatures"),
        SectionDef("imports", 4, "full"),
        SectionDef("callers", 5, "summary"),
        SectionDef("callees", 6, "summary"),
        SectionDef("type_definitions", 7, "full"),
    )),
    "modify" to IntentStrategy("modify", listOf(
        SectionDef("source", 1, "full"),
        SectionDef("callers", 2, "full"),
        SectionDef("callees", 3, "full"),
        SectionDef("tests", 4, "full"),
        SectionDef("imports", 5, "full"),
        SectionDef("type_definitions", 6, "full"),
        SectionDef("siblings", 7, "signatures"),
    )),
    "debug" to IntentStrategy("debug", listOf(
        SectionDef("source", 1, "full"),
        SectionDef("callers", 2, "full"),
        SectionDef("error_patterns", 3, "full"),
        SectionDef("recent_changes", 4, "full"),
        SectionDef("imports", 5, "full"),
        SectionDef("siblings", 6, "signatures"),
        SectionDef("callees", 7, "summary"),
    )),
    "test" to IntentStrategy("test", listOf(
        SectionDef("source", 1, "full"),
        SectionDef("tests", 2, "full"),
        SectionDef("test_patterns", 3, "full"),
        SectionDef("callees", 4, "full"),
        SectionDef("type_definitions", 5, "full"),
        SectionDef("mocks_needed", 6, "full"),
        SectionDef("siblings", 7, "signatures"),
    )),
)

/** Get the intent strategy for a given intent. Falls back to 'explain'. */
fun getStrategy(intent: String): IntentStrategy =
    STRATEGIES[intent] ?: STRATEGIES["explain"]!!

/** Get all supported intent names. */
fun getSupportedIntents(): List<String> = STRATEGIES.keys.toList()
