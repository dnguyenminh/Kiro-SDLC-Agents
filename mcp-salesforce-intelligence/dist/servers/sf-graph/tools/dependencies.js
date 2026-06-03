"use strict";
/**
 * sf_dependencies tool — Get forward dependencies of a component.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dependenciesSchema = void 0;
exports.handleDependencies = handleDependencies;
const zod_1 = require("zod");
exports.dependenciesSchema = zod_1.z.object({
    node_name: zod_1.z.string().min(1, 'node_name is required'),
    depth: zod_1.z.number().optional().default(3),
    include_types: zod_1.z.array(zod_1.z.string()).optional(),
});
async function handleDependencies(args, graph) {
    const parsed = exports.dependenciesSchema.safeParse(args);
    if (!parsed.success) {
        return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
    }
    const { node_name, depth, include_types } = parsed.data;
    const result = graph.getForwardDeps(node_name, Math.min(depth, 10), include_types);
    return JSON.stringify(result);
}
//# sourceMappingURL=dependencies.js.map