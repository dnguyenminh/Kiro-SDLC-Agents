"use strict";
/**
 * sf_impact_analysis tool — Analyze impact of changing a component.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.impactAnalysisSchema = void 0;
exports.handleImpactAnalysis = handleImpactAnalysis;
const zod_1 = require("zod");
exports.impactAnalysisSchema = zod_1.z.object({
    node_name: zod_1.z.string().min(1, 'node_name is required'),
    depth: zod_1.z.number().optional().default(3),
});
async function handleImpactAnalysis(args, graph) {
    const parsed = exports.impactAnalysisSchema.safeParse(args);
    if (!parsed.success) {
        return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
    }
    const { node_name, depth } = parsed.data;
    const result = graph.getImpact(node_name, Math.min(depth, 10));
    return JSON.stringify(result);
}
//# sourceMappingURL=impact-analysis.js.map