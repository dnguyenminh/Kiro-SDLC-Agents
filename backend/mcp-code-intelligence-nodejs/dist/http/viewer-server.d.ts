/**
 * HTTP server for Knowledge Graph viewer — uses Node.js built-in http module.
 * All HTML/CSS/JS served from shared/viewer/ (single source of truth).
 */
import { MemoryEngine } from '../memory/memory-engine.js';
import { KnowledgeGraph } from '../memory/knowledge-graph.js';
import { ModelManager } from '../orchestration/models/model-manager.js';
export declare class ViewerServer {
    private server;
    private port;
    /** Late-binding — set after MCP initialize completes. */
    memoryEngine: MemoryEngine | null;
    knowledgeGraph: KnowledgeGraph | null;
    modelManager: ModelManager | null;
    workspace: string;
    constructor(port: number, workspace?: string);
    start(): void;
    stop(): void;
    private handleRequest;
    private serveSharedFile;
    private serveSubdirStatic;
    private serveStatic;
    /** Resolve path within viewer/. Checks bundled dist/viewer/ first, then workspace shared/viewer/. */
    private resolveSharedPath;
    /** Error page when shared/viewer/ files are missing. */
    private serveViewerError;
    private serveHealth;
    private send404;
    private sendJson;
}
//# sourceMappingURL=viewer-server.d.ts.map