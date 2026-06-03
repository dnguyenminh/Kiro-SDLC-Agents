"use strict";
/**
 * Knowledge Base client — integrates with mcp-code-intelligence KB via HTTP API.
 * Used by sf-kb-indexer to ingest parsed metadata and search.
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
exports.KBClient = void 0;
const http = __importStar(require("http"));
const DEFAULT_KB_PORT = 3200;
const INGEST_TIMEOUT = 3000;
const SEARCH_TIMEOUT = 3000;
const BATCH_SIZE = 10;
class KBClient {
    workspace;
    baseUrl;
    constructor(workspace, port) {
        this.workspace = workspace;
        const p = port ?? parseInt(process.env['SF_KB_PORT'] ?? String(DEFAULT_KB_PORT), 10);
        this.baseUrl = `http://localhost:${p}`;
    }
    /** Ingest a single entry into KB */
    async ingest(payload) {
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
    async batchIngest(payloads) {
        let ingested = 0;
        let failed = 0;
        for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
            const batch = payloads.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(batch.map(p => this.ingest(p)));
            for (const ok of results) {
                if (ok)
                    ingested++;
                else
                    failed++;
            }
        }
        return { ingested, failed };
    }
    /** Search KB for entries matching query */
    async search(query, metadataType, limit = 10) {
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
                    }
                    catch {
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
exports.KBClient = KBClient;
//# sourceMappingURL=kb-client.js.map