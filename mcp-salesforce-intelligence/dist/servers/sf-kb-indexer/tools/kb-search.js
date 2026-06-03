"use strict";
/**
 * sf_kb_search tool — Search KB for indexed Salesforce metadata.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.kbSearchSchema = void 0;
exports.handleKbSearch = handleKbSearch;
const zod_1 = require("zod");
const kb_client_js_1 = require("../../../shared/kb-client.js");
exports.kbSearchSchema = zod_1.z.object({
    query: zod_1.z.string().min(1, 'query is required'),
    metadata_type: zod_1.z.string().optional(),
    limit: zod_1.z.number().optional().default(10),
});
async function handleKbSearch(args, workspace) {
    const parsed = exports.kbSearchSchema.safeParse(args);
    if (!parsed.success)
        return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
    const { query, metadata_type, limit } = parsed.data;
    const cappedLimit = Math.min(limit, 50);
    const kbClient = new kb_client_js_1.KBClient(workspace);
    const results = await kbClient.search(query, metadata_type, cappedLimit);
    return JSON.stringify({ query, metadata_type: metadata_type ?? null, results, total: results.length });
}
//# sourceMappingURL=kb-search.js.map