"use strict";
/**
 * Nested orchestrator detection — detect child servers that are orchestrators.
 * A server is considered a nested orchestrator if it exposes find_tools or execute_dynamic_tool.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNestedOrchestrator = isNestedOrchestrator;
exports.detectNested = detectNested;
const ORCHESTRATOR_MARKERS = ['find_tools', 'execute_dynamic_tool'];
/** Check if a set of tool names indicates a nested orchestrator. */
function isNestedOrchestrator(toolNames) {
    return ORCHESTRATOR_MARKERS.some(marker => toolNames.includes(marker));
}
/** Detect and log nested orchestrators from server tool lists. */
function detectNested(serverName, tools) {
    const names = tools.map(t => t.name);
    const isNested = isNestedOrchestrator(names);
    if (isNested) {
        console.error(`[orchestration] Nested orchestrator detected on '${serverName}' — tools accessible via find_tools`);
    }
    return isNested;
}
//# sourceMappingURL=nested-detection.js.map