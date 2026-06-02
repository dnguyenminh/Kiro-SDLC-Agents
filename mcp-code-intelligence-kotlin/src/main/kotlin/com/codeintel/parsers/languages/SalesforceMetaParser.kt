/**
 * KSA-191: Salesforce Metadata Parser — Regex-based XML extraction.
 * Handles: .flow-meta.xml, .object-meta.xml, .field-meta.xml,
 *          .js-meta.xml, .component-meta.xml
 * No tree-sitter — uses regex XML parsing for well-structured SF metadata.
 */
package com.codeintel.parsers.languages

import com.codeintel.parsers.*

class SalesforceMetaParser(languageId: String = "salesforce-meta") : BaseLanguageParser(languageId) {

    override fun getSupportedExtensions() = listOf(
        ".flow-meta.xml", ".object-meta.xml", ".field-meta.xml",
        ".js-meta.xml", ".component-meta.xml"
    )

    override fun parse(source: String, filePath: String): ParseResult {
        val symbols = mutableListOf<ExtractedSymbol>()
        val rels = mutableListOf<ExtractedRelationship>()
        return try {
            when (detectMetaType(filePath)) {
                "flow" -> parseFlow(source, filePath, symbols, rels)
                "object" -> parseObject(source, filePath, symbols, rels)
                "field" -> parseField(source, filePath, symbols, rels)
                "lwc-meta" -> parseLWCMeta(source, filePath, symbols, rels)
                "aura-meta" -> parseAuraMeta(source, filePath, symbols)
            }
            ParseResult(symbols, rels)
        } catch (e: Exception) {
            ParseResult(symbols, rels, listOf(
                ParseError("XML parse error: ${e.message}", 1, 0)))
        }
    }

    private fun detectMetaType(filePath: String): String? {
        val lower = filePath.lowercase()
        return when {
            lower.endsWith(".flow-meta.xml") -> "flow"
            lower.endsWith(".object-meta.xml") -> "object"
            lower.endsWith(".field-meta.xml") -> "field"
            lower.endsWith(".js-meta.xml") -> "lwc-meta"
            lower.endsWith(".component-meta.xml") -> "aura-meta"
            else -> null
        }
    }

    private fun parseFlow(
        source: String, filePath: String,
        symbols: MutableList<ExtractedSymbol>,
        rels: MutableList<ExtractedRelationship>
    ) {
        val flowName = nameFromPath(filePath)
        val processType = extractXmlValue(source, "processType") ?: "Flow"
        val lineCount = source.count { it == '\n' } + 1

        symbols.add(buildSymbol(flowName, "class", filePath, 1, lineCount,
            "Flow: $flowName ($processType)",
            modifiers = listOf(processType.lowercase()), isExported = true))

        // Variables as properties
        extractXmlBlocks(source, "variables").forEach { block ->
            val varName = extractXmlValue(block, "name") ?: return@forEach
            val dataType = extractXmlValue(block, "dataType") ?: "String"
            symbols.add(buildSymbol(varName, "property", filePath, 1, 1,
                "$varName: $dataType", parentName = flowName,
                returnType = dataType, isExported = false))
        }

        // Decisions as methods
        extractXmlBlocks(source, "decisions").forEach { block ->
            val name = extractXmlValue(block, "name") ?: return@forEach
            symbols.add(buildSymbol(name, "method", filePath, 1, 1,
                "Decision: $name", parentName = flowName, isExported = false))
        }

        // Action calls — Apex invocations
        extractXmlBlocks(source, "actionCalls").forEach { block ->
            val actionName = extractXmlValue(block, "name") ?: return@forEach
            val actionType = extractXmlValue(block, "actionType")
            symbols.add(buildSymbol(actionName, "method", filePath, 1, 1,
                "Action: $actionName ($actionType)",
                parentName = flowName, isExported = false))
            if (actionType == "apex") {
                val className = extractXmlValue(block, "actionName")
                if (className != null) {
                    rels.add(buildRelationship(flowName, className, "calls",
                        filePath, 1, mapOf("actionType" to "apex")))
                }
            }
        }

        // Record operations -> 'uses' relationships
        for (tag in RECORD_OPERATION_TAGS) {
            extractXmlBlocks(source, tag).forEach { block ->
                val objectName = extractXmlValue(block, "object")
                if (objectName != null) {
                    val op = tag.removePrefix("record").lowercase()
                    rels.add(buildRelationship(flowName, objectName, "uses",
                        filePath, 1, mapOf("operation" to op)))
                }
            }
        }
    }

    private fun parseObject(
        source: String, filePath: String,
        symbols: MutableList<ExtractedSymbol>,
        rels: MutableList<ExtractedRelationship>
    ) {
        val objectName = nameFromPath(filePath)
        val lineCount = source.count { it == '\n' } + 1

        symbols.add(buildSymbol(objectName, "class", filePath, 1, lineCount,
            "CustomObject: $objectName",
            modifiers = listOf("custom-object"), isExported = true))

        // Fields
        extractXmlBlocks(source, "fields").forEach { block ->
            val fieldName = extractXmlValue(block, "fullName") ?: return@forEach
            val fieldType = extractXmlValue(block, "type") ?: "Text"
            symbols.add(buildSymbol(fieldName, "property", filePath, 1, 1,
                "$fieldName: $fieldType", parentName = objectName,
                returnType = fieldType, isExported = true))
            if (fieldType in LOOKUP_TYPES) {
                val referenceTo = extractXmlValue(block, "referenceTo")
                if (referenceTo != null) {
                    rels.add(buildRelationship(objectName, referenceTo, "uses",
                        filePath, 1, mapOf("relationType" to fieldType)))
                }
            }
        }

        // Validation rules
        extractXmlBlocks(source, "validationRules").forEach { block ->
            val ruleName = extractXmlValue(block, "fullName") ?: return@forEach
            symbols.add(buildSymbol(ruleName, "method", filePath, 1, 1,
                "ValidationRule: $ruleName",
                parentName = objectName, isExported = false))
        }
    }

    private fun parseField(
        source: String, filePath: String,
        symbols: MutableList<ExtractedSymbol>,
        rels: MutableList<ExtractedRelationship>
    ) {
        val fieldName = nameFromPath(filePath)
        val fieldType = extractXmlValue(source, "type") ?: "Text"
        val parentObject = inferObjectFromFieldPath(filePath)
        val lineCount = source.count { it == '\n' } + 1

        symbols.add(buildSymbol(fieldName, "property", filePath, 1, lineCount,
            "$fieldName: $fieldType", parentName = parentObject,
            returnType = fieldType, isExported = true))

        if (fieldType in LOOKUP_TYPES && parentObject != null) {
            val referenceTo = extractXmlValue(source, "referenceTo")
            if (referenceTo != null) {
                rels.add(buildRelationship(parentObject, referenceTo, "uses",
                    filePath, 1,
                    mapOf("relationType" to fieldType, "field" to fieldName)))
            }
        }
    }

    private fun parseLWCMeta(
        source: String, filePath: String,
        symbols: MutableList<ExtractedSymbol>,
        rels: MutableList<ExtractedRelationship>
    ) {
        val componentName = nameFromPath(filePath)
        symbols.add(buildSymbol(componentName, "class", filePath, 1,
            source.count { it == '\n' } + 1,
            "LWC: $componentName", modifiers = listOf("lwc"), isExported = true))

        // Wire adapters -> 'wire' relationships
        extractXmlBlocks(source, "targets").forEach { block ->
            val target = extractXmlValue(block, "target")
            if (target != null) {
                rels.add(buildRelationship(componentName, target, "wire",
                    filePath, 1))
            }
        }
    }

    private fun parseAuraMeta(
        source: String, filePath: String,
        symbols: MutableList<ExtractedSymbol>
    ) {
        val componentName = nameFromPath(filePath)
        symbols.add(buildSymbol(componentName, "class", filePath, 1,
            source.count { it == '\n' } + 1,
            "Aura: $componentName", modifiers = listOf("aura"), isExported = true))
    }

    companion object {
        private val RECORD_OPERATION_TAGS = listOf(
            "recordLookups", "recordCreates", "recordUpdates", "recordDeletes")
        private val LOOKUP_TYPES = setOf("Lookup", "MasterDetail")

        /** Extract first XML element text content by tag name. */
        fun extractXmlValue(source: String, tagName: String): String? {
            val re = Regex("<$tagName>([^<]*)</$tagName>")
            return re.find(source)?.groupValues?.get(1)
        }

        /** Extract all XML blocks (multi-line elements) by tag name. */
        fun extractXmlBlocks(source: String, tagName: String): List<String> {
            val re = Regex("<$tagName>[\\s\\S]*?</$tagName>")
            return re.findAll(source).map { it.value }.toList()
        }

        /** Extract component name from file path. */
        fun nameFromPath(filePath: String): String {
            val basename = filePath.replace("\\", "/").substringAfterLast("/")
            return basename
                .replace(Regex("""\.(?:flow|object|field|js|component)-meta\.xml$"""), "")
                .replace(Regex("""\.\w+$"""), "")
        }

        /** Infer parent object from field path structure. */
        fun inferObjectFromFieldPath(filePath: String): String? {
            val normalized = filePath.replace("\\", "/")
            val match = Regex("""objects/([^/]+)/fields/""").find(normalized)
            return match?.groupValues?.get(1)
        }
    }
}
