/**
 * FindToolsTool — semantic search across all registered tools + KB + nested delegates.
 * KSA-66: Nested delegation — delegates to child orchestrators for lazy discovery.
 * KSA-102: Adaptive Token Cache (Tier 2) + Embedding Search (Tier 3).
 * KSA-139: KB-backed 2-Level Agent Tool Cache (Tier 0 — checked first).
 * KSA-141: Sync Tier 0 KB cache in executeFindTools for behavioral parity.
 * Behavioral parity with Python find_tools.py.
 */
import { OrchestrationEngine } from '../engine.js';
/** Execute tokenized search for tools matching query. */
export declare function executeFindTools(engine: OrchestrationEngine, args: Record<string, any>): string;
/** Async version of executeFindTools for use in async contexts. */
export declare function executeFindToolsAsync(engine: OrchestrationEngine, args: Record<string, any>): Promise<string>;
//# sourceMappingURL=find-tools.d.ts.map