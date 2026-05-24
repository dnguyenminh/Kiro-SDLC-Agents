"use strict";
/**
 * FindToolsTool — semantic search across all registered tools + KB + nested delegates.
 * KSA-66: Nested delegation — delegates to child orchestrators for lazy discovery.
 * KSA-102: Adaptive Token Cache (Tier 2) + Embedding Search (Tier 3).
 * KSA-139: KB-backed 2-Level Agent Tool Cache (Tier 0 — checked first).
 * Behavioral parity with Python find_tools.py.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeFindTools = executeFindTools;
exports.executeFindToolsAsync = executeFindToolsAsync;
const tokenizer_js_1 = require("../registry/tokenizer.js");
/** Execute tokenized search for tools matching query. */
function executeFindTools(engine, args) {
    const query = args.query;
    if (!query)
        return JSON.stringify({ error: "Missing 'query'" });
    let registryResults = engine.getRegistry().search(query);
    // If no results from registry, try recovering FAILED servers (lazy retry)
    if (registryResults.length === 0) {
        const recovered = retryFailedServersSync(engine);
        if (recovered) {
            registryResults = engine.getRegistry().search(query);
        }
    }
    // Tier 1: Registry has results → return immediately
    if (registryResults.length > 0) {
        return JSON.stringify(registryResults.slice(0, 10).map((t) => t.definition));
    }
    // Tier 2: Adaptive Token Cache (KSA-102, ~0ms)
    const cacheResult = searchCache(engine, query);
    if (cacheResult)
        return cacheResult;
    // Tier 3: Embedding Search (KSA-102, ~10-50ms)
    const embeddingResult = searchEmbedding(engine, query);
    if (embeddingResult)
        return embeddingResult;
    // Tier 4: Delegate to nested (sync version fires async, results on next call)
    const nestedResults = delegateToNested(engine, query);
    if (nestedResults.length > 0) {
        return JSON.stringify(nestedResults.slice(0, 10));
    }
    // Tier 5: KB fallback
    const kbResults = searchKb(engine, query);
    if (kbResults.length > 0) {
        return JSON.stringify(kbResults.slice(0, 10).map((t) => t.definition));
    }
    // KSA-102 Story 5: Multilingual hint when non-ASCII query fails
    const hint = getMultilingualHint(engine, query);
    if (hint)
        return JSON.stringify({ tools: [], _hint: hint });
    return '[]';
}
/** Delegate find_tools to nested orchestrators and cache results. */
async function delegateToNestedAsync(engine, query) {
    const delegates = engine.getFindToolsDelegates();
    if (delegates.length === 0)
        return [];
    console.error(`[find_tools] Delegating to [${delegates.join(', ')}]`);
    const allResults = [];
    for (const serverName of delegates) {
        try {
            const raw = await engine.callChild(serverName, 'find_tools', { query });
            const tools = parseToolList(raw);
            console.error(`[find_tools] Nested on ${serverName} returned ${tools.length} tools`);
            for (const toolDef of tools) {
                const originalName = toolDef.name ?? '';
                if (!originalName)
                    continue;
                const uniqueName = `${serverName}::${originalName}`;
                engine.registerNestedTool(uniqueName, serverName, originalName, toolDef);
                allResults.push(toolDef);
            }
        }
        catch (e) {
            console.error(`[find_tools] Nested failed on ${serverName}: ${e.message}`);
        }
    }
    return allResults;
}
/** Sync wrapper — runs nested delegation (blocks via top-level await pattern). */
function delegateToNested(engine, query) {
    const delegates = engine.getFindToolsDelegates();
    if (delegates.length === 0)
        return [];
    // Use synchronous approach: schedule and return empty for now,
    // results will be available on next call (lazy caching pattern)
    delegateToNestedAsync(engine, query).catch((e) => console.error(`[find_tools] Background delegation error: ${e.message}`));
    return [];
}
/** Attempt to recover FAILED servers synchronously (fire-and-forget, returns true if scheduled). */
function retryFailedServersSync(engine) {
    try {
        engine.retryFailedServers().catch((e) => console.error(`[find_tools] Retry failed servers error: ${e.message}`));
        // Cannot await in sync context — return false so caller doesn't retry search immediately.
        // The async version (executeFindToolsAsync) handles this properly with await.
        return false;
    }
    catch {
        return false;
    }
}
/** Async version of executeFindTools for use in async contexts. */
async function executeFindToolsAsync(engine, args) {
    const query = args.query;
    if (!query)
        return JSON.stringify({ error: "Missing 'query'" });
    const agentName = args.agent_name ?? 'default';
    // Tier 0: KB-backed 2-Level Cache (KSA-139) — fastest path
    const kbCacheResult = await searchKbCache(engine, query, agentName);
    if (kbCacheResult)
        return kbCacheResult;
    let registryResults = engine.getRegistry().search(query);
    // If no results from registry, try recovering FAILED servers (lazy retry)
    if (registryResults.length === 0) {
        const recovered = await engine.retryFailedServers();
        if (recovered.length > 0) {
            registryResults = engine.getRegistry().search(query);
        }
    }
    // Tier 1: Registry has results → return immediately
    if (registryResults.length > 0) {
        return JSON.stringify(registryResults.slice(0, 10).map((t) => t.definition));
    }
    // Tier 2: Adaptive Token Cache (KSA-102, ~0ms)
    const cacheResult = searchCache(engine, query);
    if (cacheResult)
        return cacheResult;
    // Tier 3: Embedding Search (KSA-102, ~10-50ms)
    const embeddingResult = searchEmbedding(engine, query);
    if (embeddingResult)
        return embeddingResult;
    // Tier 4: Delegate to nested find_tools (expensive, up to 45s)
    const nestedResults = await delegateToNestedAsync(engine, query);
    if (nestedResults.length > 0) {
        return JSON.stringify(nestedResults.slice(0, 10));
    }
    // Tier 5: KB fallback
    const kbResults = searchKb(engine, query);
    if (kbResults.length > 0) {
        return JSON.stringify(kbResults.slice(0, 10).map((t) => t.definition));
    }
    // KSA-102 Story 5: Multilingual hint when non-ASCII query fails
    const hintAsync = getMultilingualHint(engine, query);
    if (hintAsync)
        return JSON.stringify({ tools: [], _hint: hintAsync });
    return '[]';
}
/** Tier 2: Search adaptive token cache for fuzzy match. */
function searchCache(engine, query) {
    try {
        const cache = engine.getTokenCache();
        const tokens = (0, tokenizer_js_1.tokenize)(query);
        const cached = cache.findFuzzy(tokens);
        if (!cached)
            return null;
        const tool = engine.getRegistry().find(cached.toolName);
        if (!tool)
            return null;
        cache.schedulePersist();
        console.error(`[find_tools] Cache hit: '${query}' → ${cached.toolName} (hits=${cached.hitCount})`);
        return JSON.stringify([tool.definition]);
    }
    catch (e) {
        console.error(`[find_tools] Cache search error: ${e.message}`);
        return null;
    }
}
/** Tier 3: Search via embedding similarity with timeout. */
function searchEmbedding(engine, query) {
    try {
        const searcher = engine.getEmbeddingSearcher();
        if (!searcher || !searcher.isAvailable) {
            engine.getModelManager().autoDownloadIfNeeded();
            return null;
        }
        const result = searcher.search(query, 100);
        if (!result)
            return null;
        const [toolName, score] = result;
        if (score < 0.75)
            return null;
        const tool = engine.getRegistry().find(toolName);
        if (!tool)
            return null;
        // Self-learning: add to cache for future fast lookups
        const tokens = (0, tokenizer_js_1.tokenize)(query);
        const cache = engine.getTokenCache();
        const registryHash = engine.getRegistry().versionHash();
        cache.add(tokens, toolName, score, registryHash);
        cache.schedulePersist();
        console.error(`[find_tools] Embedding hit: '${query}' → ${toolName} (score=${score.toFixed(3)})`);
        return JSON.stringify([tool.definition]);
    }
    catch (e) {
        console.error(`[find_tools] Embedding search error: ${e.message}`);
        return null;
    }
}
/** Parse raw JSON response into list of tool definitions. */
function parseToolList(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed))
            return parsed;
        if (parsed && Array.isArray(parsed.tools))
            return parsed.tools;
        if (parsed && typeof parsed === 'object')
            return [parsed];
        return [];
    }
    catch {
        return [];
    }
}
/** Session-level flag: only show multilingual hint once. */
let multilingualHintShown = false;
/** Return multilingual model hint if query has non-ASCII and model is English-only. */
function getMultilingualHint(engine, query) {
    if (multilingualHintShown)
        return null;
    if (/^[\x00-\x7F]*$/.test(query))
        return null;
    const active = engine.getModelManager().getActiveModel();
    if (active !== 'all-MiniLM-L6-v2')
        return null;
    multilingualHintShown = true;
    return ("💡 Tip: Current model is English-only. For better multilingual support, run: " +
        "mem_model_manager(action='download', model_name='paraphrase-multilingual-MiniLM-L12-v2') " +
        "then mem_model_manager(action='switch', model_name='paraphrase-multilingual-MiniLM-L12-v2')");
}
/** Search KB for tool definitions (best-effort). */
function searchKb(engine, query) {
    const mem = engine.getMemoryEngine();
    if (!mem)
        return [];
    try {
        const results = mem.search?.search(query, { limit: 20 }) ?? [];
        return resolveKbResults(engine, results);
    }
    catch {
        return [];
    }
}
/** Tier 0: KB-backed 2-Level Agent Tool Cache (KSA-139). */
async function searchKbCache(engine, query, agentName) {
    try {
        const lookup = engine.getKbCacheLookup();
        const result = await lookup.find(query, agentName);
        if (!result)
            return null;
        const { entry, source } = result;
        // Try to resolve from registry for full definition
        const tool = engine.getRegistry().find(entry.toolName);
        if (tool) {
            return JSON.stringify([tool.definition]);
        }
        // If not in registry, build definition from cache entry
        return JSON.stringify([{
                name: entry.toolName,
                description: entry.description,
                inputSchema: entry.inputSchema,
                _source: source,
                _server: entry.serverName,
            }]);
    }
    catch (e) {
        console.error(`[find_tools] KB cache error: ${e.message}`);
        return null;
    }
}
/** Parse KB results → extract tool names → lookup in registry. */
function resolveKbResults(engine, results) {
    const resolved = [];
    for (const result of results) {
        const content = typeof result === 'string' ? result : (result?.content ?? String(result));
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            const toolName = trimmed.split(' [')[0]?.trim();
            if (!toolName)
                continue;
            const tool = engine.getRegistry().find(toolName);
            if (tool)
                resolved.push(tool);
        }
    }
    return resolved;
}
/** Merge registry + nested results, deduplicate by tool name. */
function mergeResults(registry, nested) {
    const seen = new Set(registry.map((t) => t.definition.name ?? t.name));
    const merged = [...registry];
    for (const toolDef of nested) {
        const name = toolDef.name ?? '';
        if (name && !seen.has(name)) {
            seen.add(name);
            merged.push({ name, definition: toolDef, source: 'nested', priority: 0, nameTokens: new Set(), descTokens: new Set() });
        }
    }
    return merged;
}
//# sourceMappingURL=find-tools.js.map