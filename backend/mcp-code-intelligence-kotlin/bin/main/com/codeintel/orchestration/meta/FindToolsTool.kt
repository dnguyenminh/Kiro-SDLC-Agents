/**
 * find_tools meta-tool — tokenized search across all registered tools (native + child)
 * by name and description. Merges registry results with KB search + nested delegation.
 * KSA-66: Nested delegation — delegates to child orchestrators when local search has no results.
 * KSA-102: Adaptive Token Cache (Tier 2) + Embedding Search (Tier 3).
 * KSA-139/141: KB-backed 2-Level Agent Tool Cache (Tier 0 — checked first).
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
        val agentName = args["agent_name"]?.jsonPrimitive?.content ?: "default"

        // Tier 0: KB-backed 2-Level Cache (KSA-139/141) — fastest path
        val kbCacheResult = searchKbCache(query, agentName)
        if (kbCacheResult != null) return kbCacheResult

        return searchWithFallback(query)
    }

    /** Tier 0: KB-backed 2-Level Agent Tool Cache (KSA-139/141). */
    private fun searchKbCache(query: String, agentName: String): String? {
        return try {
            val lookup = engine.getKbCacheLookup()
            val result = lookup.find(query, agentName) ?: return null
            val tool = engine.getRegistry().find(result.entry.toolName)
            if (tool != null) return encodeDefinitions(listOf(tool))
            // Not in registry — build definition from cache entry
            val def = buildJsonObject {
                put("name", result.entry.toolName)
                put("description", result.entry.description)
                put("inputSchema", result.entry.inputSchema)
                put("_source", result.source.name)
                put("_server", result.entry.serverName)
            }
            json.encodeToString(JsonArray.serializer(), buildJsonArray { add(def) })
        } catch (e: Exception) {
            log("[find_tools] KB cache error: ${e.message}")
            null
        }
    }

    /** Registry → Token Cache → Embedding → Nested → KB fallback. */
    private fun searchWithFallback(query: String): String {
        var registryResults = engine.getRegistry().search(query)
        if (registryResults.isEmpty()) {
            retryFailedServers()
            registryResults = engine.getRegistry().search(query)
        }
        if (registryResults.isNotEmpty()) return encodeDefinitions(registryResults.take(10))

        val cacheResult = searchCache(query)
        if (cacheResult != null) return cacheResult

        val embeddingResult = searchEmbedding(query)
        if (embeddingResult != null) return embeddingResult

        val nestedResults = delegateToNested(query)
        if (nestedResults.isNotEmpty()) {
            val nestedTools = nestedResults.take(10).map { toolDef ->
                RegisteredTool(toolDef["name"]?.jsonPrimitive?.content ?: "", toolDef, "nested", 0)
            }
            return encodeDefinitions(nestedTools)
        }

        val kbResults = searchKb(query)
        if (kbResults.isNotEmpty()) return encodeDefinitions(kbResults.take(10))

        val hint = getMultilingualToolHint(engine, query)
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
            val tokens = Tokenizer.tokenize(query)
            val cache = engine.getTokenCache()
            cache.add(tokens, toolName, score.toDouble(), engine.getRegistry().versionHash())
            cache.schedulePersist()
            log("[find_tools] Embedding hit: '$query' → $toolName (score=${String.format("%.3f", score)})")
            encodeDefinitions(listOf(tool))
        } catch (e: Exception) {
            log("[find_tools] Embedding search error: ${e.message}")
            null
        }
    }

    /** Attempt to recover FAILED servers (lazy retry on find_tools call). */
    private fun retryFailedServers() {
        try { runBlocking { engine.retryFailedServers() } }
        catch (e: Exception) { log("[find_tools] Retry failed servers error: ${e.message}") }
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

    private fun callNestedFindTools(serverName: String, query: String): List<JsonObject> {
        val raw = runBlocking {
            engine.callChild(serverName, "find_tools", buildJsonObject { put("query", query) })
        }
        return parseToolList(raw)
    }

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

    private fun searchKb(query: String): List<RegisteredTool> = searchKbForTools(engine, query)

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
