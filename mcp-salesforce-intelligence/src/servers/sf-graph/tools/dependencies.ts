/**
 * sf_dependencies tool — Get forward dependencies of a component.
 */

import { z } from 'zod';
import { DependencyGraph } from '../graph/dependency-graph.js';

export const dependenciesSchema = z.object({
  node_name: z.string().min(1, 'node_name is required'),
  depth: z.number().optional().default(3),
  include_types: z.array(z.string()).optional(),
});

export async function handleDependencies(args: Record<string, unknown>, graph: DependencyGraph): Promise<string> {
  const parsed = dependenciesSchema.safeParse(args);
  if (!parsed.success) {
    return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
  }
  const { node_name, depth, include_types } = parsed.data;
  const result = graph.getForwardDeps(node_name, Math.min(depth, 10), include_types);
  return JSON.stringify(result);
}
