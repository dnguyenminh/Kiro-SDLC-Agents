/** Document parsing — extracts structured content from various formats. */
package com.codeintel.memory.ingest

/** Parsed document with metadata. */
data class ParsedDocument(
    val title: String,
    val content: String,
    val sections: List<DocumentSection>,
    val metadata: Map<String, String>
)

/** A section within a document. */
data class DocumentSection(
    val heading: String,
    val content: String,
    val level: Int
)

/** Parses markdown documents into structured sections. */
object DocumentParser {

    /** Parse markdown text into structured document. */
    fun parseMarkdown(text: String, source: String = ""): ParsedDocument {
        val lines = text.lines()
        val title = extractTitle(lines)
        val sections = extractSections(lines)
        val metadata = mapOf("source" to source, "format" to "markdown")
        return ParsedDocument(title, text, sections, metadata)
    }

    /** Parse plain text (no structure). */
    fun parsePlainText(text: String, source: String = ""): ParsedDocument {
        val metadata = mapOf("source" to source, "format" to "text")
        val section = DocumentSection("Content", text, 1)
        return ParsedDocument(source, text, listOf(section), metadata)
    }

    private fun extractTitle(lines: List<String>): String {
        val h1 = lines.firstOrNull { it.startsWith("# ") }
        return h1?.removePrefix("# ")?.trim() ?: "Untitled"
    }

    private fun extractSections(lines: List<String>): List<DocumentSection> {
        val sections = mutableListOf<DocumentSection>()
        var currentHeading = ""
        var currentLevel = 0
        val content = StringBuilder()

        for (line in lines) {
            val headingMatch = Regex("^(#{1,6})\\s+(.+)").find(line)
            if (headingMatch != null) {
                if (content.isNotBlank() || currentHeading.isNotEmpty()) {
                    sections.add(DocumentSection(currentHeading, content.toString().trim(), currentLevel))
                    content.clear()
                }
                currentLevel = headingMatch.groupValues[1].length
                currentHeading = headingMatch.groupValues[2]
            } else {
                content.appendLine(line)
            }
        }
        if (content.isNotBlank() || currentHeading.isNotEmpty()) {
            sections.add(DocumentSection(currentHeading, content.toString().trim(), currentLevel))
        }
        return sections
    }
}
