/**
 * ExecuteDynamicTool — execute tool with mapping check + fallback chain support.
 * KSA-66: Routes via bridge's execute_dynamic_tool for nested tools (mapping check first).
 * KSA-139: Post-execution hooks for KB cache population/invalidation.
 * Behavioral parity with Python execute_dynamic.py.
 */
import { OrchestrationEngine } from '../engine.js';
/** Execute a tool by name — mapping → chain → single routing. */
export declare function executeDynamic(engine: OrchestrationEngine, args: Record<string, any>): Promise<string>;
//# sourceMappingURL=execute-dynamic.d.ts.map