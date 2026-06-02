/**
 * sf_graph_export tool — Export dependency graph in JSON or DOT format.
 */

import { z } from 'zod';
import { DependencyGraph } from '../graph/dependency-graph.js';

export const graphExportSchema = z.object({
  format: z.enum(['json', 'dot']).optional().default('json'),
  include_types: z.array(z.string()).optional(),
});

export async function handleGraphExport(args: Record<string, unknown>, graph: DependencyGraph): Promise<string> {
  const parsed = graphExportSchema.safeParse(args);
  if (!parsed.success) {
    return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
  }
  const { format, include_types } = parsed.data;

  if (format === 'dot') {
    return graph.exportDOT(include_types);
  }
  return JSON.stringify(graph.exportJSON(include_types));
}
