/** Recognize dynamic dispatch patterns that reduce dead code confidence. */
package com.codeintel.analyzers.similarity

/** Detect if a function might be called via dynamic dispatch. */
class DynamicDispatchRecognizer {

    companion object {
        private val DYNAMIC_PATTERNS = listOf(
            Regex("""\bgetattr\s*\("""),
            Regex("""\bsetattr\s*\("""),
            Regex("""\b__getattr__\b"""),
            Regex("""\b__call__\b"""),
            Regex("""@\w+\.register"""),
            Regex("""@app\.route"""),
            Regex("""@router\.\w+"""),
            Regex("""\bplugin\b.*\bregister\b""", RegexOption.IGNORE_CASE),
            Regex("""\bfactory\b.*\bcreate\b""", RegexOption.IGNORE_CASE),
            Regex("""\bregistry\b""", RegexOption.IGNORE_CASE),
            Regex("""\.class\.getDeclaredMethod"""),
            Regex("""Class\.forName"""),
            Regex("""@Component|@Service|@Bean|@Inject"""),
            Regex("""\bReflect\.\w+"""),
            Regex("""\[.*]\s*\("""),
        )

        private val DEPRECATED_MARKERS = listOf(
            "@deprecated", "@Deprecated",
            "# deprecated", "# DEPRECATED",
            "warnings.warn", "DeprecationWarning",
        )
    }

    /** Check if source code contains dynamic dispatch patterns. */
    fun isDynamicallyDispatched(sourceCode: String): Boolean {
        return DYNAMIC_PATTERNS.any { it.containsMatchIn(sourceCode) }
    }

    /** Check if function name appears in config content. */
    fun isConfigReferenced(functionName: String, configContent: String): Boolean {
        return functionName in configContent
    }

    /** Check if function has deprecation markers. */
    fun hasDeprecatedMarker(sourceCode: String): Boolean {
        return DEPRECATED_MARKERS.any { it in sourceCode }
    }
}
