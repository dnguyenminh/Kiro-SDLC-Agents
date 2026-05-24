/**
 * Nested orchestrator detection — detect child servers that are orchestrators.
 * A server is considered a nested orchestrator if it exposes find_tools or execute_dynamic_tool.
 */
/** Check if a set of tool names indicates a nested orchestrator. */
export declare function isNestedOrchestrator(toolNames: string[]): boolean;
/** Detect and log nested orchestrators from server tool lists. */
export declare function detectNested(serverName: string, tools: Array<{
    name: string;
}>): boolean;
//# sourceMappingURL=nested-detection.d.ts.map