/**
 * sf_graph_export tool — Export dependency graph in JSON or DOT format.
 */
import { z } from 'zod';
import { DependencyGraph } from '../graph/dependency-graph.js';
export declare const graphExportSchema: z.ZodObject<{
    format: z.ZodDefault<z.ZodOptional<z.ZodEnum<["json", "dot"]>>>;
    include_types: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    format: "json" | "dot";
    include_types?: string[] | undefined;
}, {
    include_types?: string[] | undefined;
    format?: "json" | "dot" | undefined;
}>;
export declare function handleGraphExport(args: Record<string, unknown>, graph: DependencyGraph): Promise<string>;
//# sourceMappingURL=graph-export.d.ts.map