/**
 * sf_impact_analysis tool — Analyze impact of changing a component.
 */

import { z } from 'zod';
import { DependencyGraph } from '../graph/dependency-graph.js';

export const impactAnalysisSchema = z.object({
  node_name: z.string().min(1, 'node_name is required'),
  depth: z.number().optional().default(3),
});

export async function handleImpactAnalysis(args: Record<string, unknown>, graph: DependencyGraph): Promise<string> {
  const parsed = impactAnalysisSchema.safeParse(args);
  if (!parsed.success) {
    return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
  }
  const { node_name, depth } = parsed.data;
  const result = graph.getImpact(node_name, Math.min(depth, 10));
  return JSON.stringify(result);
}
