/**
 * sf_impact_analysis tool — Analyze impact of changing a component.
 */
import { z } from 'zod';
import { DependencyGraph } from '../graph/dependency-graph.js';
export declare const impactAnalysisSchema: z.ZodObject<{
    node_name: z.ZodString;
    depth: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    depth: number;
    node_name: string;
}, {
    node_name: string;
    depth?: number | undefined;
}>;
export declare function handleImpactAnalysis(args: Record<string, unknown>, graph: DependencyGraph): Promise<string>;
//# sourceMappingURL=impact-analysis.d.ts.map