#!/usr/bin/env node
"use strict";
/**
 * MCP Code Intelligence Server — Entry Point (stdio JSON-RPC 2.0).
 * Workspace is resolved from MCP initialize request roots[0].uri.
 * Indexing is deferred until after initialize completes.
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
const readline = __importStar(require("readline"));
const config_js_1 = require("./config.js");
const database_manager_js_1 = require("./db/database-manager.js");
const indexing_engine_js_1 = require("./indexer/indexing-engine.js");
const register_tools_js_1 = require("./tools/register-tools.js");
const tool_call_ingest_js_1 = require("./tools/tool-call-ingest.js");
const memory_engine_js_1 = require("./memory/memory-engine.js");
const viewer_server_js_1 = require("./http/viewer-server.js");
const index_js_1 = require("./memory/embedding/index.js");
const config_js_2 = require("./orchestration/config.js");
const engine_js_1 = require("./orchestration/engine.js");
const SERVER_INFO = { name: 'mcp-code-intelligence', version: '0.2.0' };
const PROTOCOL_VERSION = '2024-11-05';
let _memEngine = null;
let _viewerServer = null;
let _orchEngine = null;
async function main() {
    let config = (0, config_js_1.loadConfig)();
    let db = null;
    let indexer = null;
    let memEngine = null;
    let initialized = false;
    console.error('[code-intel] Server starting (workspace deferred until initialize)');
    const rl = readline.createInterface({ input: process.stdin, terminal: false });
    for await (const line of rl) {
        if (!line.trim())
            continue;
        let request;
        try {
            request = JSON.parse(line);
        }
        catch {
            send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
            continue;
        }
        const method = request.method ?? '';
        const reqId = request.id ?? null;
        const params = request.params ?? {};
        // Skip notifications (no id)
        if (reqId === null && method.startsWith('notifications/'))
            continue;
        if (method === 'initialize') {
            console.error(`[code-intel] DEBUG initialize params: ${JSON.stringify(params)}`);
            console.error(`[code-intel] DEBUG roots: ${JSON.stringify(params?.roots)}`);
            console.error(`[code-intel] DEBUG extractRootUri: ${extractRootUri(params)}`);
            config = (0, config_js_1.setWorkspace)(config, extractRootUri(params));
            console.error(`[code-intel] Workspace: ${config.workspace}`);
            console.error(`[code-intel] DB path: ${config.dbPath}`);
            db = new database_manager_js_1.DatabaseManager(config.dbPath);
            db.initialize();
            indexer = new indexing_engine_js_1.IndexingEngine(db, config);
            initialized = true;
            // Initialize memory engine
            const memoryEngine = new memory_engine_js_1.MemoryEngine(db.getDb());
            memoryEngine.startSession('mcp-client');
            memEngine = memoryEngine;
            _memEngine = memoryEngine;
            // Initialize embedding (optional: Ollama → ONNX → null)
            const embeddingService = index_js_1.EmbeddingFactory.create(config, memoryEngine.vectors);
            if (embeddingService) {
                console.error('[code-intel] EmbeddingService initialized — vectors enabled');
            }
            else {
                console.error('[code-intel] EmbeddingService not available — using BM25 only');
            }
            // Wire memory dispatcher with embedding
            (0, register_tools_js_1.initMemoryDispatcher)(memoryEngine, config.workspace, embeddingService);
            const memDispatcher = (0, register_tools_js_1.getMemoryDispatcherInstance)();
            if (memDispatcher)
                (0, tool_call_ingest_js_1.setIngestDispatcher)(memDispatcher);
            // Start viewer server (skip if port < 0)
            if (config.viewerPort >= 0) {
                const viewerServer = new viewer_server_js_1.ViewerServer(config.viewerPort, config.workspace);
                viewerServer.memoryEngine = memoryEngine;
                viewerServer.knowledgeGraph = memoryEngine.graph;
                viewerServer.start();
                _viewerServer = viewerServer;
            }
            // Initialize orchestration engine (nullable — skipped if no config)
            const orchConfigPath = (0, config_js_1.resolveOrchestrationConfigPath)();
            const orchConfig = orchConfigPath
                ? (0, config_js_2.loadOrchestrationConfigFromPath)(orchConfigPath)
                : (0, config_js_2.loadOrchestrationConfig)(config.workspace);
            if (orchConfig) {
                const orchEngine = new engine_js_1.OrchestrationEngine(orchConfig, memoryEngine, config);
                await orchEngine.start();
                _orchEngine = orchEngine;
                (0, register_tools_js_1.initOrchestration)(orchEngine);
                if (_viewerServer)
                    _viewerServer.modelManager = orchEngine.getModelManager();
                console.error('[code-intel] OrchestrationEngine started');
            }
            else {
                console.error('[code-intel] No orchestration.json — orchestration disabled');
            }
            send({ jsonrpc: '2.0', id: reqId, result: buildInitializeResult() });
            // Start background indexing after responding
            indexer.startBackgroundIndexing().catch((err) => {
                console.error('[code-intel] Indexing error:', err);
            });
            continue;
        }
        if (!initialized || !db || !indexer) {
            send({ jsonrpc: '2.0', id: reqId, error: { code: -32002, message: 'Server not initialized' } });
            continue;
        }
        const response = await handleRequest(method, reqId, params, db, indexer, config);
        if (response)
            send(response);
    }
    // Cleanup on stdin close
    cleanup();
}
function cleanup() {
    console.error('[code-intel] Shutting down...');
    if (_orchEngine) {
        _orchEngine.stop();
        _orchEngine = null;
    }
    if (_viewerServer) {
        _viewerServer.stop();
        _viewerServer = null;
    }
    if (_memEngine) {
        _memEngine.endSession();
        _memEngine = null;
    }
}
async function handleRequest(method, id, params, db, indexer, config) {
    switch (method) {
        case 'tools/list':
            return { jsonrpc: '2.0', id, result: { tools: (0, register_tools_js_1.getToolDefinitions)() } };
        case 'tools/call': {
            // Log ALL tool calls to audit for stream tab
            if (_memEngine) {
                const toolName = params.name ?? '';
                const details = `${toolName}(${JSON.stringify(params.arguments ?? {}).substring(0, 150)})`;
                _memEngine.audit.log('TOOL_CALL', undefined, _memEngine.getSessionId() ?? undefined, details);
            }
            const text = await (0, register_tools_js_1.dispatchTool)(params.name, params.arguments ?? {}, db, indexer, config.workspace);
            (0, tool_call_ingest_js_1.maybeIngestToolCall)(params.name ?? '', params.arguments ?? {}, text);
            return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } };
        }
        case 'ping':
            return { jsonrpc: '2.0', id, result: {} };
        default:
            return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
}
function buildInitializeResult() {
    return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
    };
}
function extractRootUri(params) {
    const roots = params?.roots;
    if (Array.isArray(roots) && roots.length > 0 && roots[0]?.uri) {
        return roots[0].uri;
    }
    return null;
}
function send(response) {
    process.stdout.write(JSON.stringify(response) + '\n');
}
function setupShutdown() {
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
    process.on('SIGTERM', () => { cleanup(); process.exit(0); });
}
setupShutdown();
main().catch((err) => {
    console.error('[code-intel] Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map