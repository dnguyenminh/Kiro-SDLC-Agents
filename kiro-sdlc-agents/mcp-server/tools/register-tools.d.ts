/**
 * Tool registration and dispatch — provides both SDK registration and raw dispatch.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseManager } from '../db/database-manager.js';
import { IndexingEngine } from '../indexer/indexing-engine.js';
import { MemoryEngine, MemoryToolDispatcher } from '../memory/index.js';
import { EmbeddingService } from '../memory/embedding/index.js';
import { OrchestrationEngine } from '../orchestration/engine.js';
/** Register all 7 MCP tools on the server instance (SDK mode). */
export declare function registerTools(server: McpServer, dbManager: DatabaseManager, indexer: IndexingEngine, workspace: string): void;
/** Get tool definitions for tools/list response (raw mode). */
export declare function getToolDefinitions(): object[];
/** Dispatch a tool call and return result text (raw mode). */
export declare function dispatchTool(name: string, args: Record<string, unknown>, dbManager: DatabaseManager, indexer: IndexingEngine, workspace: string): Promise<string>;
/** Wire orchestration engine into tool dispatch. */
export declare function initOrchestration(engine: OrchestrationEngine): void;
/** Initialize memory dispatcher with engine and optional embedding. */
export declare function initMemoryDispatcher(engine: MemoryEngine, workspace: string, embeddingService: EmbeddingService | null): void;
/** Get the initialized memory dispatcher (for tool-call ingest hook). */
export declare function getMemoryDispatcherInstance(): MemoryToolDispatcher | null;
//# sourceMappingURL=register-tools.d.ts.map