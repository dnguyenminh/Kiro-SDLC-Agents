"use strict";
/**
 * Orchestration engine — coordinator that wires all components together.
 * Behavioral parity with Kotlin OrchestrationEngine.kt.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestrationEngine = void 0;
const path = __importStar(require("path"));
const config_js_1 = require("./config.js");
const index_js_1 = require("./local/index.js");
const index_js_2 = require("./registry/index.js");
const index_js_3 = require("./routing/index.js");
const auto_logger_js_1 = require("./logging/auto-logger.js");
const dispatcher_js_1 = require("./meta/dispatcher.js");
const index_js_4 = require("./cache/index.js");
const index_js_5 = require("./models/index.js");
const index_js_6 = require("./embedding/index.js");
class OrchestrationEngine {
    metaToolDispatcher;
    config;
    memoryEngine;
    appConfig;
    serverManager;
    routingTable = new index_js_3.RoutingTable();
    registry;
    router;
    autoLogger;
    configWatcher = null;
    started = false;
    findToolsDelegates = [];
    toolMapping = new Map();
    tokenCache = null;
    modelManager = null;
    embeddingSearcher = null;
    kbCacheLookup = null;
    kbCacheWriter = null;
    kbCacheInvalidator = null;
    kbInjectionEngine = null;
    kbCacheConfig = null;
    constructor(config, memoryEngine, appConfig) {
        this.config = config;
        this.memoryEngine = memoryEngine;
        this.appConfig = appConfig;
        this.serverManager = new index_js_1.LocalServerManager(config);
        this.registry = new index_js_2.UnifiedRegistry(config.settings.similarityThreshold);
        this.router = new index_js_3.SmartRouter(this.serverManager, this.routingTable);
        this.autoLogger = new auto_logger_js_1.AutoLogger(memoryEngine, config.settings.autoLog);
        this.metaToolDispatcher = new dispatcher_js_1.MetaToolDispatcher(this);
    }
    /** Start orchestration — spawn servers, build routing, ingest KB. */
    async start() {
        const servers = (0, config_js_1.enabledServers)(this.config);
        this.registry.setServerOrder([...servers.keys()]);
        const count = await this.serverManager.startAll();
        this.buildRoutingTable();
        this.ingestToolsToKb();
        this.started = true;
        this.startConfigWatcher();
        console.error(`[orchestration] Started: ${count}/${servers.size} servers active`);
    }
    /** Stop orchestration. */
    stop() {
        if (!this.started)
            return;
        this.configWatcher?.stop();
        this.serverManager.stopAll();
        this.started = false;
        console.error('[orchestration] Stopped');
    }
    /** Route a tool call to the appropriate child server. */
    async route(toolName, args) {
        if (!this.started)
            throw new Error('Orchestration not started');
        const start = Date.now();
        this.router.requestStartTime = start;
        try {
            const timeout = this.getTimeout(toolName);
            const result = await this.router.route(toolName, args, timeout);
            const latency = Date.now() - start;
            const source = this.serverManager.findServerForTool(toolName) ?? 'unknown';
            this.autoLogger.logCall(toolName, JSON.stringify(args), result, latency, source);
            return result;
        }
        catch (e) {
            const latency = Date.now() - start;
            this.autoLogger.logCall(toolName, JSON.stringify(args), e.message, latency, 'unknown', true);
            throw e;
        }
    }
    getRegistry() { return this.registry; }
    getMemoryEngine() { return this.memoryEngine; }
    isEnabled() { return this.started; }
    /** Lazy-init adaptive token cache. */
    getTokenCache() {
        if (!this.tokenCache) {
            const cachePath = path.join(this.getWorkspace(), '.code-intel', 'token-cache.json');
            this.tokenCache = new index_js_4.AdaptiveTokenCache(cachePath);
        }
        return this.tokenCache;
    }
    /** Get embedding searcher (null if ONNX unavailable). */
    getEmbeddingSearcher() {
        if (!this.embeddingSearcher) {
            try {
                this.embeddingSearcher = new index_js_6.EmbeddingSearcher(this.getModelManager(), this.registry);
            }
            catch {
                return null;
            }
        }
        return this.embeddingSearcher;
    }
    /** Get model manager instance. */
    getModelManager() {
        if (!this.modelManager)
            this.modelManager = new index_js_5.ModelManager();
        return this.modelManager;
    }
    /** Get KB cache config (lazy-loaded, hot-reloadable). */
    getKbCacheConfig() {
        if (!this.kbCacheConfig) {
            const configPath = path.join(this.getWorkspace(), '.code-intel', 'orchestration.json');
            this.kbCacheConfig = (0, index_js_4.readKbCacheConfig)(configPath);
        }
        return this.kbCacheConfig;
    }
    /** Get KB cache lookup (L2 → L1 cascade). */
    getKbCacheLookup() {
        if (!this.kbCacheLookup) {
            this.kbCacheLookup = new index_js_4.KbCacheLookup(this.memoryEngine, this.getKbCacheConfig());
        }
        return this.kbCacheLookup;
    }
    /** Get KB cache writer (async fire-and-forget). */
    getKbCacheWriter() {
        if (!this.kbCacheWriter) {
            this.kbCacheWriter = new index_js_4.KbCacheWriter(this.memoryEngine, this.getKbCacheConfig());
        }
        return this.kbCacheWriter;
    }
    /** Get KB cache invalidator. */
    getKbCacheInvalidator() {
        if (!this.kbCacheInvalidator) {
            this.kbCacheInvalidator = new index_js_4.KbCacheInvalidator(this.memoryEngine);
        }
        return this.kbCacheInvalidator;
    }
    /** Get KB injection engine for sub-agent prompt enrichment. */
    getKbInjectionEngine() {
        if (!this.kbInjectionEngine) {
            this.kbInjectionEngine = new index_js_4.KbInjectionEngine(this.memoryEngine, this.getKbCacheConfig());
        }
        return this.kbInjectionEngine;
    }
    getStatus() {
        return {
            enabled: this.started,
            servers: this.serverManager.getStatus().size,
            hiddenTools: this.registry.allChildTools().length,
        };
    }
    getServerStatus() { return this.serverManager.getServerStatusInfo(); }
    getMetrics() { return this.router.getMetrics(); }
    /** Retry FAILED servers and rebuild routing if any recover. */
    async retryFailedServers() {
        const recovered = await this.serverManager.retryFailedServers();
        if (recovered.length > 0) {
            this.buildRoutingTable();
            console.error(`[orchestration] Recovered servers: [${recovered.join(', ')}] — routing rebuilt`);
        }
        return recovered;
    }
    async callChild(serverName, toolName, args) {
        const result = await this.serverManager.callTool(serverName, toolName, args, 30_000);
        return this.extractText(result);
    }
    getWorkspace() { return this.appConfig?.workspace ?? ''; }
    /** Get server names that have nested find_tools capability. */
    getFindToolsDelegates() { return this.findToolsDelegates; }
    /** Get (serverName, originalName) for a previously discovered nested tool. */
    getToolMapping(toolName) {
        return this.toolMapping.get(toolName) ?? null;
    }
    /** Register a tool discovered via nested find_tools delegation. */
    registerNestedTool(uniqueName, serverName, originalName, definition) {
        this.toolMapping.set(uniqueName, [serverName, originalName]);
        this.toolMapping.set(originalName, [serverName, originalName]);
        this.registry.registerNested(uniqueName, serverName, definition);
        this.routingTable.addRoute(originalName, serverName);
    }
    /** Get all active child server names. */
    getChildServerNames() {
        const status = this.serverManager.getStatus();
        const result = [];
        for (const [name, state] of status) {
            if (state === index_js_1.ServerState.ACTIVE)
                result.push(name);
        }
        return result;
    }
    buildRoutingTable() {
        const allTools = this.serverManager.getAllTools();
        const byServer = new Map();
        for (const [name, tool] of allTools) {
            const list = byServer.get(name) ?? [];
            list.push(tool);
            byServer.set(name, list);
        }
        for (const [serverName, tools] of byServer) {
            this.registry.setChildTools(serverName, tools);
        }
        this.routingTable.rebuild(new Set(), this.registry.childToolsByServer());
        this.buildDelegationList(allTools);
    }
    /** Identify child servers that expose find_tools (nested orchestrators). */
    buildDelegationList(allTools) {
        this.findToolsDelegates = [];
        const serversWithFind = new Set();
        for (const [serverName, toolDef] of allTools) {
            if (toolDef.name === 'find_tools')
                serversWithFind.add(serverName);
        }
        this.findToolsDelegates = [...serversWithFind];
        console.error(`[orchestration] Delegation list: find_tools → [${this.findToolsDelegates.join(', ')}]`);
    }
    ingestToolsToKb() {
        if (!this.memoryEngine)
            return;
        const tools = this.registry.allChildTools();
        if (tools.length === 0)
            return;
        const content = tools.map((t) => `${t.name} [${t.source}]: ${t.definition.description ?? ''}`).join('\n');
        try {
            this.memoryEngine.knowledge.insert({
                content, summary: `Orchestration child tools registry (${tools.length} tools)`,
                type: 'CONTEXT', tier: 'WORKING', source: 'orchestration-startup', tags: 'tools,registry,orchestration',
            });
            console.error(`[orchestration] Ingested ${tools.length} child tool definitions into KB`);
        }
        catch (e) {
            console.error(`[orchestration] Failed to ingest tools to KB: ${e.message}`);
        }
    }
    startConfigWatcher() {
        const workspace = this.getWorkspace();
        const configPath = path.join(workspace, '.code-intel', 'orchestration.json');
        this.configWatcher = new index_js_1.ConfigWatcher(configPath, (newConfig) => this.onConfigReload(newConfig));
        this.configWatcher.start();
    }
    async onConfigReload(newConfig) {
        this.config = newConfig;
        this.serverManager.stopAll();
        this.serverManager.updateConfig(newConfig);
        this.registry.setServerOrder([...(0, config_js_1.enabledServers)(newConfig).keys()]);
        await this.serverManager.startAll();
        this.buildRoutingTable();
        this.ingestToolsToKb();
    }
    getTimeout(toolName) {
        const serverName = this.serverManager.findServerForTool(toolName);
        if (serverName && this.config.mcpServers[serverName])
            return this.config.mcpServers[serverName].timeout;
        return 30_000;
    }
    extractText(result) {
        if (!result)
            return '{}';
        if (Array.isArray(result?.content) && result.content.length > 0)
            return result.content[0]?.text ?? '{}';
        return JSON.stringify(result);
    }
}
exports.OrchestrationEngine = OrchestrationEngine;
//# sourceMappingURL=engine.js.map