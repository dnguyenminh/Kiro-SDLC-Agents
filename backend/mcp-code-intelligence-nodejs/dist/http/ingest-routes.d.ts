/**
 * HTTP ingest-file route — POST /api/memory/ingest-file.
 * Allows extension to directly index documents without going through MCP stdio.
 */
import * as http from 'http';
import { MemoryEngine } from '../memory/memory-engine.js';
/** Handle POST /api/memory/ingest-file. */
export declare function handleIngestFileRoute(req: http.IncomingMessage, url: URL, res: http.ServerResponse, engine: MemoryEngine | null, workspace: string): void;
//# sourceMappingURL=ingest-routes.d.ts.map