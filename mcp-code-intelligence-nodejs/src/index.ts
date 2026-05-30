#!/usr/bin/env node
/**
 * MCP Code Intelligence Server — Entry Point (stdio JSON-RPC 2.0).
 * Workspace is resolved from MCP initialize request roots[0].uri.
 * Indexing is deferred until after initialize completes.
 */

import * as readline from 'readline';
import { loadConfig, setWorkspace, AppConfig, resolveOrchestrationConfigPath } from './config.js';
import { DatabaseManager } from './db/database-manager.js';
import { IndexingEngine } from './indexer/indexing-engine.js';
import { getToolDefinitions, dispatchTool, initMemoryDispatcher, initOrchestration, getMemoryDispatcherInstance } from './tools/register-tools.js';
import { maybeIngestToolCall, setIngestDispatcher } from './tools/tool-call-ingest.js';
import { MemoryEngine } from './memory/memory-engine.js';
import { ViewerServer } from './http/viewer-server.js';
import { EmbeddingFactory } from './memory/embedding/index.js';
import { loadOrchestrationConfig, loadOrchestrationConfigFromPath } from './orchestration/config.js';
import { OrchestrationEngine } from './orchestration/engine.js';

const SERVER_INFO = { name: 'mcp-code-intelligence', version: '0.2.0' };
const PROTOCOL_VERSION = '2024-11-05';
let _memEngine: MemoryEngine | null = null;
let _viewerServer: ViewerServer | null = null;
let _orchEngine: OrchestrationEngine | null = null;

async function main(): Promise<void> {
  let config = loadConfig();
  let db: DatabaseManager | null = null;
  let indexer: IndexingEngine | null = null;
  let memEngine: MemoryEngine | null = null;
  let initialized = false;

  // Pre-resolve native binding (downloads prebuilt binary in standalone mode)
  await DatabaseManager.preResolveBinding();

  console.error('[code-intel] Server starting (workspace deferred until initialize)');

  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  for await (const line of rl) {
    if (!line.trim()) continue;

    let request: any;
    try {
      request = JSON.parse(line);
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      continue;
    }

    const method = request.method ?? '';
    const reqId = request.id ?? null;
    const params = request.params ?? {};

    // Skip notifications (no id)
    if (reqId === null && method.startsWith('notifications/')) continue;

    if (method === 'initialize') {
      console.error(`[code-intel] DEBUG initialize params: ${JSON.stringify(params)}`);
      console.error(`[code-intel] DEBUG roots: ${JSON.stringify(params?.roots)}`);
      console.error(`[code-intel] DEBUG extractRootUri: ${extractRootUri(params)}`);
      config = setWorkspace(config, extractRootUri(params));
      console.error(`[code-intel] Workspace: ${config.workspace}`);
      console.error(`[code-intel] DB path: ${config.dbPath}`);

      // Respond IMMEDIATELY — heavy loading runs in background
      initialized = true;
      send({ jsonrpc: '2.0', id: reqId, result: buildInitializeResult() });

      // Background initialization (parallel where possible)
      (async () => {
        try {
          // Phase 1: DB + Memory (sequential — memory depends on DB)
          db = new DatabaseManager(config.dbPath);
          db.initialize();
          indexer = new IndexingEngine(db, config);

          const memoryEngine = new MemoryEngine(db.getDb());
          memoryEngine.startSession('mcp-client');
          memEngine = memoryEngine;
          _memEngine = memoryEngine;

          // Phase 2: Parallel — embedding, viewer, orchestration
          const embeddingPromise = Promise.resolve().then(() => {
            const svc = EmbeddingFactory.create(config, memoryEngine.vectors);
            console.error(svc ? '[code-intel] EmbeddingService initialized — vectors enabled' : '[code-intel] EmbeddingService not available — using BM25 only');
            return svc;
          });

          const viewerPromise = Promise.resolve().then(() => {
            if (process.env['DISABLE_VIEWER'] !== '1') {
              const vs = new ViewerServer(config.viewerPort, config.workspace);
              vs.memoryEngine = memoryEngine;
              vs.knowledgeGraph = memoryEngine.graph;
              vs.start();
              _viewerServer = vs;
            }
          });

          const orchPromise = (async () => {
            const ocp = resolveOrchestrationConfigPath();
            const oc = ocp ? loadOrchestrationConfigFromPath(ocp) : loadOrchestrationConfig(config.workspace);
            if (oc) {
              const oe = new OrchestrationEngine(oc, memoryEngine, config);
              await oe.start();
              _orchEngine = oe;
              initOrchestration(oe);
              if (_viewerServer) _viewerServer.modelManager = oe.getModelManager();
              console.error('[code-intel] OrchestrationEngine started');
            } else {
              console.error('[code-intel] No orchestration.json — orchestration disabled');
            }
          })();

          // Wait for embedding (needed for memory dispatcher)
          const embeddingService = await embeddingPromise;
          initMemoryDispatcher(memoryEngine, config.workspace, embeddingService);
          const memDispatcher = getMemoryDispatcherInstance();
          if (memDispatcher) setIngestDispatcher(memDispatcher);

          // Wait for viewer + orchestration
          await Promise.all([viewerPromise, orchPromise]);

          // Background indexing
          indexer!.startBackgroundIndexing().catch((e) => console.error('[code-intel] Indexing error:', e));
          console.error('[code-intel] Background initialization complete');
        } catch (err) {
          console.error('[code-intel] Background init error:', err);
        }
      })();
      continue;
    }

    if (!initialized || !db || !indexer) {
      send({ jsonrpc: '2.0', id: reqId, error: { code: -32002, message: 'Server initializing — please retry in a moment' } });
      continue;
    }

    const response = await handleRequest(method, reqId, params, db, indexer, config);
    if (response) send(response);
  }

  // Cleanup on stdin close
  cleanup();
}

function cleanup(): void {
  console.error('[code-intel] Shutting down...');
  if (_orchEngine) { _orchEngine.stop(); _orchEngine = null; }
  if (_viewerServer) { _viewerServer.stop(); _viewerServer = null; }
  if (_memEngine) { _memEngine.endSession(); _memEngine = null; }
}

async function handleRequest(
  method: string, id: any, params: any,
  db: DatabaseManager, indexer: IndexingEngine, config: AppConfig
): Promise<any> {
  switch (method) {
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: getToolDefinitions() } };
    case 'tools/call': {
      // Log ALL tool calls to audit for stream tab
      if (_memEngine) {
        const toolName = params.name ?? '';
        const details = `${toolName}(${JSON.stringify(params.arguments ?? {}).substring(0, 150)})`;
        _memEngine.audit.log('TOOL_CALL', undefined, _memEngine.getSessionId() ?? undefined, details);
      }
      const text = await dispatchTool(params.name, params.arguments ?? {}, db, indexer, config.workspace);
      maybeIngestToolCall(params.name ?? '', params.arguments ?? {}, text);
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } };
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

function buildInitializeResult(): object {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: { tools: { listChanged: false } },
    serverInfo: SERVER_INFO,
  };
}

function extractRootUri(params: any): string | null {
  const roots = params?.roots;
  if (Array.isArray(roots) && roots.length > 0 && roots[0]?.uri) {
    return roots[0].uri;
  }
  return null;
}

function send(response: any): void {
  process.stdout.write(JSON.stringify(response) + '\n');
}

function setupShutdown(): void {
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
}

setupShutdown();
main().catch((err) => {
  console.error('[code-intel] Fatal error:', err);
  process.exit(1);
});
