/**
 * Knowledge Base client — integrates with mcp-code-intelligence KB via HTTP API.
 * Used by sf-kb-indexer to ingest parsed metadata and search.
 */
import type { KBPayload, KBResult } from './types.js';
export declare class KBClient {
    private workspace;
    private readonly baseUrl;
    constructor(workspace: string, port?: number);
    /** Ingest a single entry into KB */
    ingest(payload: KBPayload): Promise<boolean>;
    /** Batch ingest multiple entries, processing in groups */
    batchIngest(payloads: KBPayload[]): Promise<{
        ingested: number;
        failed: number;
    }>;
    /** Search KB for entries matching query */
    search(query: string, metadataType?: string, limit?: number): Promise<KBResult[]>;
}
//# sourceMappingURL=kb-client.d.ts.map