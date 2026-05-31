"use strict";
/**
 * ExecuteDynamicTool — execute tool with mapping check + fallback chain support.
 * KSA-66: Routes via bridge's execute_dynamic_tool for nested tools (mapping check first).
 * KSA-139: Post-execution hooks for KB cache population/invalidation.
 * KSA-141: Error scoring (-10 penalty) on all execution paths.
 * Behavioral parity with Python execute_dynamic.py.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeDynamic = executeDynamic;
const index_js_1 = require("../cache/index.js");
/** Execute a tool by name — mapping → chain → single routing. */
async function executeDynamic(engine, args) {
    const toolName = args.tool_name;
    if (!toolName)
        return JSON.stringify({ error: "Missing 'tool_name'" });
    const toolArgs = args.arguments ?? {};
    const agentName = args.agent_name ?? 'default';
    const mapping = engine.getToolMapping(toolName);
    if (mapping)
        return executeViaBridgeWithCache(engine, toolName, mapping, toolArgs, agentName);
    const chain = engine.getRegistry().getChain(toolName);
    if (chain)
        return executeChainWithCache(engine, chain, toolArgs, agentName);
    return executeSingleWithCache(engine, toolName, toolArgs, agentName);
}
/** Execute via nested server's execute_dynamic_tool (bridge pattern). */
async function executeViaBridge(engine, toolName, mapping, args) {
    const [serverName, originalName] = mapping;
    const bridgeArgs = { tool_name: originalName, arguments: args };
    try {
        const result = await engine.callChild(serverName, 'execute_dynamic_tool', bridgeArgs);
        engine.getRegistry().recordHit(toolName, 1);
        if (!isErrorResult(result)) {
            engine.getRegistry().recordHit(toolName, 3);
        }
        else {
            engine.getRegistry().recordHit(toolName, -10);
        }
        return result;
    }
    catch (e) {
        engine.getRegistry().recordHit(toolName, -10);
        return JSON.stringify({ error: `Nested execute failed on ${serverName}: ${e.message}` });
    }
}
/** Execute through fallback chain — try each server in priority order. */
async function executeChain(engine, chain, args) {
    const errors = [];
    for (const entry of chain.entries) {
        const actualName = entry.toolName ?? chain.toolName;
        try {
            const result = await engine.callChild(entry.serverName, actualName, args);
            engine.getRegistry().recordHit(chain.toolName, 1);
            if (!isErrorResult(result)) {
                engine.getRegistry().recordHit(chain.toolName, 3);
            }
            else {
                engine.getRegistry().recordHit(chain.toolName, -10);
            }
            return result;
        }
        catch (e) {
            errors.push(`${entry.serverName}: ${e.message}`);
        }
    }
    // All servers in chain failed — penalize
    engine.getRegistry().recordHit(chain.toolName, -10);
    return JSON.stringify({ error: `Tool '${chain.toolName}' failed on all ${chain.entries.length} servers: [${errors.join(', ')}]` });
}
/** Execute on single server via normal routing. */
async function executeSingle(engine, toolName, args) {
    try {
        const result = await engine.route(toolName, args);
        engine.getRegistry().recordHit(toolName, 1);
        if (!isErrorResult(result)) {
            engine.getRegistry().recordHit(toolName, 3);
        }
        else {
            engine.getRegistry().recordHit(toolName, -10);
        }
        return result;
    }
    catch (e) {
        engine.getRegistry().recordHit(toolName, -10);
        return JSON.stringify({ error: e.message });
    }
}
function isErrorResult(result) {
    return result.trimStart().startsWith('{"error"') || result.slice(0, 100).includes('"error"');
}
/** Execute via bridge with KB cache hooks (KSA-139). */
async function executeViaBridgeWithCache(engine, toolName, mapping, args, agentName) {
    const result = await executeViaBridge(engine, toolName, mapping, args);
    if (!isErrorResult(result)) {
        fireCacheWrite(engine, toolName, mapping[0], agentName);
    }
    else {
        fireCacheInvalidate(engine, toolName, agentName, result);
    }
    return result;
}
/** Execute chain with KB cache hooks (KSA-139). */
async function executeChainWithCache(engine, chain, args, agentName) {
    const result = await executeChain(engine, chain, args);
    const toolName = chain.toolName;
    if (!isErrorResult(result)) {
        const serverName = chain.entries?.[0]?.serverName ?? 'unknown';
        fireCacheWrite(engine, toolName, serverName, agentName);
    }
    else {
        fireCacheInvalidate(engine, toolName, agentName, result);
    }
    return result;
}
/** Execute single with KB cache hooks (KSA-139). */
async function executeSingleWithCache(engine, toolName, args, agentName) {
    const result = await executeSingle(engine, toolName, args);
    if (!isErrorResult(result)) {
        const tool = engine.getRegistry().find(toolName);
        const serverName = tool?.source ?? 'unknown';
        fireCacheWrite(engine, toolName, serverName, agentName);
    }
    else {
        fireCacheInvalidate(engine, toolName, agentName, result);
    }
    return result;
}
/** Fire-and-forget: write to KB cache on success (KSA-139). */
function fireCacheWrite(engine, toolName, serverName, agentName) {
    try {
        const writer = engine.getKbCacheWriter();
        const tool = engine.getRegistry().find(toolName);
        const description = tool?.definition?.description ?? '';
        const inputSchema = tool?.definition?.inputSchema ?? {};
        // Determine source — for now treat as DISCOVERED (first use populates cache)
        writer.onSuccess(toolName, serverName, description, inputSchema, agentName, index_js_1.CacheSource.DISCOVERED)
            .catch((e) => console.error(`[kb-cache] Write error: ${e.message}`));
    }
    catch {
        // Non-blocking — never fail execution due to cache
    }
}
/** Fire-and-forget: invalidate KB cache on failure + penalize score (KSA-139, KSA-141). */
function fireCacheInvalidate(engine, toolName, agentName, errorResult) {
    try {
        const invalidator = engine.getKbCacheInvalidator();
        invalidator.onFailure(toolName, agentName, errorResult)
            .catch((e) => console.error(`[kb-cache] Invalidate error: ${e.message}`));
    }
    catch {
        // Non-blocking
    }
    // KSA-141: Error scoring penalty in WithCache paths
    engine.getRegistry().recordHit(toolName, -10);
}
//# sourceMappingURL=execute-dynamic.js.map