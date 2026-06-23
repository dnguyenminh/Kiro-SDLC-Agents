/**
 * sf_dependencies tool — Get forward dependencies of a component.
 */
import { z } from 'zod';
import { DependencyGraph } from '../graph/dependency-graph.js';
export declare const dependenciesSchema: z.ZodObject<{
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
export declare function handleDependencies(args: Record<string, unknown>, graph: DependencyGraph): Promise<string>;
//# sourceMappingURL=dependencies.d.ts.map