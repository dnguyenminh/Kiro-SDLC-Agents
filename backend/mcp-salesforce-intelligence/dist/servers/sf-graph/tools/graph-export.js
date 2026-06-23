"use strict";
/**
 * sf_graph_export tool — Export dependency graph in JSON or DOT format.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphExportSchema = void 0;
exports.handleGraphExport = handleGraphExport;
const zod_1 = require("zod");
exports.graphExportSchema = zod_1.z.object({
    format: zod_1.z.enum(['json', 'dot']).optional().default('json'),
    include_types: zod_1.z.array(zod_1.z.string()).optional(),
});
async function handleGraphExport(args, graph) {
    const parsed = exports.graphExportSchema.safeParse(args);
    if (!parsed.success) {
        return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
    }
    const { format, include_types } = parsed.data;
    if (format === 'dot') {
        return graph.exportDOT(include_types);
    }
    return JSON.stringify(graph.exportJSON(include_types));
}
//# sourceMappingURL=graph-export.js.map