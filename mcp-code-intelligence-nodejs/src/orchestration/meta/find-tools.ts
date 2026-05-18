/**
 * FindToolsTool — semantic search across all registered tools + KB.
 * Behavioral parity with Kotlin FindToolsTool.kt.
 */

import { OrchestrationEngine } from '../engine.js';

export function executeFindTools(engine: OrchestrationEngine, args: Record<string, any>): string {
  const query = args.query;
  if (!query) return JSON.stringify({ error: "Missing 'query'" });
  const registryResults = engine.getRegistry().search(query);
  const definitions = registryResults.slice(0, 10).map((t) => t.definition);
  return JSON.stringify(definitions);
}
