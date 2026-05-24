/**
 * POST /api/memory/ingest HTTP endpoint — HTTP API for external ingest.
 */
import type { IncomingMessage, ServerResponse } from 'http';
export interface IngestRequest {
    content: string;
    type?: string;
    source?: string;
    summary?: string;
    tags?: string;
}
export interface IngestResponse {
    id: number;
    type: string;
    tier: string;
}
/** Handle POST /api/memory/ingest. */
export declare function handleIngest(req: IncomingMessage, res: ServerResponse, engine: any): Promise<void>;
//# sourceMappingURL=ingest-api.d.ts.map