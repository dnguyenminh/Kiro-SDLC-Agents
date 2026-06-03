/**
 * sf_dependents tool — Get reverse dependencies (what depends on this component).
 */
import { z } from 'zod';
import { DependencyGraph } from '../graph/dependency-graph.js';
export declare const dependentsSchema: z.ZodObject<{
    node_name: z.ZodString;
    depth: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    include_types: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    depth: number;
    node_name: string;
    include_types?: string[] | undefined;
}, {
    node_name: string;
    depth?: number | undefined;
    include_types?: string[] | undefined;
}>;
export declare function handleDependents(args: Record<string, unknown>, graph: DependencyGraph): Promise<string>;
//# sourceMappingURL=dependents.d.ts.map