/**
 * Knowledge Base client — integrates with mcp-code-intelligence KB via HTTP API.
 * Used by sf-kb-indexer to ingest parsed metadata and search.
 */

import * as http from 'http';
import type { KBPayload, KBResult } from './types.js';

const DEFAULT_KB_PORT = 3200;
const INGEST_TIMEOUT = 3000;
const SEARCH_TIMEOUT = 3000;
const BATCH_SIZE = 10;

export class KBClient {
  private readonly baseUrl: string;

  constructor(private workspace: string, port?: number) {
    const p = port ?? parseInt(process.env['SF_KB_PORT'] ?? String(DEFAULT_KB_PORT), 10);
    this.baseUrl = `http://localhost:${p}`;
  }

  /** Ingest a single entry into KB */
  async ingest(payload: KBPayload): Promise<boolean> {
    const body = JSON.stringify({
      files: [{
        content: payload.content,
        type: payload.type,
        tags: payload.tags,
        format: 'markdown',
      }],
    });

    return new Promise((resolve) => {
      const url = new URL('/api/memory/ingest-file', this.baseUrl);
      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: INGEST_TIMEOUT,
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(res.statusCode === 200));
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.write(body);
      req.end();
    });
  }

  /** Batch ingest multiple entries, processing in groups */
  async batchIngest(payloads: KBPayload[]): Promise<{ ingested: number; failed: number }> {
    let ingested = 0;
    let failed = 0;

    for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
      const batch = payloads.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(p => this.ingest(p)));
      for (const ok of results) {
        if (ok) ingested++;
        else failed++;
      }
    }

    return { ingested, failed };
  }

  /** Search KB for entries matching query */
  async search(query: string, metadataType?: string, limit: number = 10): Promise<KBResult[]> {
    const tags = metadataType ? `salesforce, ${metadataType}` : 'salesforce';
    const body = JSON.stringify({ query, tags, limit });

    return new Promise((resolve) => {
      const url = new URL('/api/memory/search', this.baseUrl);
      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: SEARCH_TIMEOUT,
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.results ?? []);
          } catch {
            resolve([]);
          }
        });
      });
      req.on('error', () => resolve([]));
      req.on('timeout', () => { req.destroy(); resolve([]); });
      req.write(body);
      req.end();
    });
  }
}
