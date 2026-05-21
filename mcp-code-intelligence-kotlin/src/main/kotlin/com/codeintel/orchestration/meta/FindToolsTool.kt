/**
 * find_tools meta-tool — tokenized search across all registered tools (native + child)
 * by name and description. Merges registry results with KB search + nested delegation.
 * KSA-66: Nested delegation — delegates to child orchestrators when local search has no results.
 * KSA-102: Adaptive Token Cache (Tier 2) + Embedding Search (Tier 3).
 */
package com.codeintel.orchestration.meta

import com.codeintel.log
import com.codeintel.orchestration.OrchestrationEngine
import com.codeintel.orchestration.registry.RegisteredTool
import com.codeintel.orchestration.registry.Tokenizer
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*

class FindToolsTool(private val engine: OrchestrationEngine) {
    private val json = Json { encodeDefaults = true }

    /** Execute tokenized search for tools matching query. */
    fun execute(args: JsonObject): String {
        val query = args["query"]?.jsonPrimitive?.content
            ?: return errorJson("Missing 'query'")
        var registryResults = engine.getRegistry().search(query)

        // If no results from registry, try recovering FAILED servers (lazy retry)
        if (registryResults.isEmpty()) {
            val recovered = retryFailedServers()
            if (recovered.isNotEmpty()) {
                registryResults = engine.getRegistry().search(query)
            }
        }

        // ALWAYS delegate to nested (lazy discovery — must run every time)
        val nestedResults = delegateToNested(query)
        val merged = mergeResults(registryResults, nestedResults)
        if (merged.isNotEmpty()) {
            return encodeDefinitions(merged.take(10))
        }

        // Tier 2: Adaptive Token Cache (KSA-102)
        val cacheResult = searchCache(query)
        if (cacheResult != null) return cacheResult

        // Tier 3: Embedding Search (KSA-102)
        val embeddingResult = searchEmbedding(query)
        if (embeddingResult != null) return embeddingResult

        // Tier 5: KB fallback
        val kbResults = searchKb(query)
        if (kbResults.isNotEmpty()) {
            return encodeDefinitions(kbResults.take(10))
        }

        // KSA-102 Story 5: Multilingual hint when non-ASCII query fails
        val hint = getMultilingualHint(query)
        if (hint != null) return """{"tools":[],"_hint":"$hint"}"""

        return "[]"
    }

    /** Tier 2: Search adaptive token cache for fuzzy match. */
    private fun searchCache(query: String): String? {
        return try {
            val cache = engine.getTokenCache()
            val tokens = Tokenizer.tokenize(query)
            val cached = cache.findFuzzy(tokens) ?: return null
            val tool = engine.getRegistry().find(cached.toolName) ?: return null
            cache.schedulePersist()
            log("[find_tools] Cache hit: '$query' → ${cached.toolName} (hits=${cached.hitCount})")
            encodeDefinitions(listOf(tool))
        } catch (e: Exception) {
            log("[find_tools] Cache search error: ${e.message}")
            null
        }
    }

    /** Tier 3: Search via embedding similarity with timeout. */
    private fun searchEmbedding(query: String): String? {
        return try {
            val searcher = engine.getEmbeddingSearcher()
            if (searcher == null || !searcher.isAvailable) {
                engine.getModelManager().autoDownloadIfNeeded()
                return null
            }
            val result = searcher.search(query, 100) ?: return null
            val (toolName, score) = result
            if (score < 0.75f) return null
            val tool = engine.getRegistry().find(toolName) ?: return null
            // Self-learning: add to cache for future fast lookups
            val tokens = Tokenizer.tokenize(query)
            val cache = engine.getTokenCache()
            val registryHash = engine.getRegistry().versionHash()
            cache.add(tokens, toolName, score.toDouble(), registryHash)
            cache.schedulePersist()
            log("[find_tools] Embedding hit: '$query' → $toolName (score=${String.format("%.3f", score)})")
            encodeDefinitions(listOf(tool))
        } catch (e: Exception) {
            log("[find_tools] Embedding search error: ${e.message}")
            null
        }
    }

    /** Attempt to recover FAILED servers (lazy retry on find_tools call). */
    private fun retryFailedServers(): List<String> {
        return try {
            runBlocking { engine.retryFailedServers() }
        } catch (e: Exception) {
            log("[find_tools] Retry failed servers error: ${e.message}")
            emptyList()
        }
    }

    /** Delegate find_tools to nested orchestrators and cache results. */
    private fun delegateToNested(query: String): List<JsonObject> {
        val delegates = engine.getFindToolsDelegates()
        if (delegates.isEmpty()) return emptyList()
        log("[find_tools] Delegating to $delegates")
        val allResults = mutableListOf<JsonObject>()
        for (serverName in delegates) {
            try {
                val tools = callNestedFindTools(serverName, query)
                log("[find_tools] Nested on $serverName returned ${tools.size} tools")
                for (toolDef in tools) {
                    val originalName = toolDef["name"]?.jsonPrimitive?.content ?: continue
                    val uniqueName = "$serverName::$originalName"
                    engine.registerNestedTool(uniqueName, serverName, originalName, toolDef)
                    allResults.add(toolDef)
                }
            } catch (e: Exception) {
                log("[find_tools] Nested failed on $serverName: ${e.message}")
            }
        }
        return allResults
    }

    /** Call find_tools on a nested server (sync wrapper for coroutine). */
    private fun callNestedFindTools(serverName: String, query: String): List<JsonObject> {
        val raw = runBlocking {
            engine.callChild(serverName, "find_tools", buildJsonObject { put("query", query) })
        }
        return parseToolList(raw)
    }

    /** Parse raw JSON response into list of tool definitions. */
    private fun parseToolList(raw: String): List<JsonObject> {
        return try {
            val element = Json.parseToJsonElement(raw)
            when {
                element is JsonArray -> element.mapNotNull { it as? JsonObject }
                element is JsonObject && element.containsKey("tools") ->
                    element["tools"]?.jsonArray?.mapNotNull { it as? JsonObject } ?: emptyList()
                element is JsonObject -> listOf(element)
                else -> emptyList()
            }
        } catch (e: Exception) {
            log("[find_tools] Failed to parse nested response: ${e.message}")
            emptyList()
        }
    }

    /** Session-level flag: only show multilingual hint once. */
    private var multilingualHintShown = false

    /** Return multilingual model hint if query has non-ASCII and model is English-only. */
    private fun getMultilingualHint(query: String): String? {
        if (multilingualHintShown) return null
        if (query.all { it.code < 128 }) return null
        val active = engine.getModelManager().getActiveModel()
        if (active != "all-MiniLM-L6-v2") return null
        multilingualHintShown = true
        return "💡 Tip: Current model is English-only. For better multilingual support, run: " +
            "mem_model_manager(action='download', model_name='paraphrase-multilingual-MiniLM-L12-v2') " +
            "then mem_model_manager(action='switch', model_name='paraphrase-multilingual-MiniLM-L12-v2')"
    }

    /** Search KB for tool definitions (best-effort, graceful degradation). */
    private fun searchKb(query: String): List<RegisteredTool> {
        val mem = engine.getMemoryEngine() ?: return emptyList()
        return try {
            val results = mem.search.search(query, limit = 20)
            resolveKbResults(results)
        } catch (e: Exception) {
            log("[find_tools] KB search failed: ${e.message}")
            emptyList()
        }
    }

    /** Parse KB results → extract tool names → lookup in registry. */
    private fun resolveKbResults(results: List<Any>): List<RegisteredTool> {
        val resolved = mutableListOf<RegisteredTool>()
        for (result in results) {
            val content = result.toString()
            for (line in content.lines()) {
                val trimmed = line.trim()
                if (trimmed.isEmpty()) continue
                val toolName = trimmed.split(" [").firstOrNull()?.trim() ?: continue
                if (toolName.isEmpty()) continue
                val tool = engine.getRegistry().find(toolName)
                if (tool != null) resolved.add(tool)
            }
        }
        return resolved
    }

    /** Merge registry + nested results, deduplicate by tool name. */
    private fun mergeResults(
        registry: List<RegisteredTool>,
        nested: List<JsonObject>
    ): List<RegisteredTool> {
        val seen = registry.map { it.definition["name"]?.jsonPrimitive?.content ?: it.name }.toMutableSet()
        val merged = registry.toMutableList()
        for (toolDef in nested) {
            val name = toolDef["name"]?.jsonPrimitive?.content ?: ""
            if (name.isNotEmpty() && name !in seen) {
                seen.add(name)
                merged.add(RegisteredTool(name, toolDef, "nested", 0))
            }
        }
        return merged
    }

    private fun encodeDefinitions(tools: List<RegisteredTool>): String {
        val arr = buildJsonArray { for (tool in tools) add(tool.definition) }
        return json.encodeToString(JsonArray.serializer(), arr)
    }

    /** Tool definition for tools/list registration. */
    fun definition(): JsonObject = buildJsonObject {
        put("name", "find_tools")
        put("description", "Search for available tools by describing what you want to accomplish. Returns tool definitions with input schemas.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("query") {
                    put("type", "string")
                    put("description", "Natural language description or keyword to search for")
                }
            }
            putJsonArray("required") { add("query") }
        }
    }

    private fun errorJson(msg: String) = """{"error":"$msg"}"""
}
