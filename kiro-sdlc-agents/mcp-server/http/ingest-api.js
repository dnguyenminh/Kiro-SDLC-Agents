"use strict";
/**
 * POST /api/memory/ingest HTTP endpoint — HTTP API for external ingest.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleIngest = handleIngest;
/** Handle POST /api/memory/ingest. */
async function handleIngest(req, res, engine) {
    if (!engine) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Memory not initialized' }));
        return;
    }
    const body = await parseBody(req);
    if (!body || !body.content || !body.content.trim()) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'content is required' }));
        return;
    }
    const summary = body.summary?.trim() || body.content.slice(0, 120);
    const type = body.type?.trim() || 'CONTEXT';
    const tags = body.tags ?? '';
    const id = engine.knowledge.insert({
        content: body.content,
        summary,
        type,
        tier: 'WORKING',
        source: body.source ?? null,
        tags,
    });
    const response = { id, type, tier: 'WORKING' };
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}
async function parseBody(req) {
    return new Promise((resolve) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString()));
            }
            catch {
                resolve(null);
            }
        });
        req.on('error', () => resolve(null));
    });
}
//# sourceMappingURL=ingest-api.js.map