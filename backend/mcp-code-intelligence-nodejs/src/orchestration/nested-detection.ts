/**
 * Nested orchestrator detection — detect child servers that are orchestrators.
 * A server is considered a nested orchestrator if it exposes find_tools or execute_dynamic_tool.
 */

const ORCHESTRATOR_MARKERS = ['find_tools', 'execute_dynamic_tool'];

/** Check if a set of tool names indicates a nested orchestrator. */
export function isNestedOrchestrator(toolNames: string[]): boolean {
  return ORCHESTRATOR_MARKERS.some(marker => toolNames.includes(marker));
}

/** Detect and log nested orchestrators from server tool lists. */
export function detectNested(
  serverName: string,
  tools: Array<{ name: string }>
): boolean {
  const names = tools.map(t => t.name);
  const isNested = isNestedOrchestrator(names);
  if (isNested) {
    console.error(`[orchestration] Nested orchestrator detected on '${serverName}' — tools accessible via find_tools`);
  }
  return isNested;
}
