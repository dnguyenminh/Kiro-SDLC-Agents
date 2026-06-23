/**
 * REST API route handlers for memory engine — search, list, graph, stats.
 * Port of Kotlin MemoryApiRoutes.kt.
 */
import * as http from 'http';
import { MemoryEngine } from '../memory/memory-engine.js';
import { KnowledgeGraph } from '../memory/knowledge-graph.js';
/** Dispatch API requests to the correct handler. */
export declare function handleApiRoute(url: URL, res: http.ServerResponse, engine: MemoryEngine | null, graph: KnowledgeGraph | null): void;
//# sourceMappingURL=api-routes.d.ts.map