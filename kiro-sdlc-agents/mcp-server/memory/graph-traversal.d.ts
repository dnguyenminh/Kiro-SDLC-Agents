/**
 * GraphTraversal — BFS, DFS, shortest path algorithms.
 */
type AdjMap = Map<number, Set<number>>;
/** BFS from start node, returns visited nodes up to maxDepth. */
export declare function bfs(adj: AdjMap, startId: number, maxDepth: number): number[];
/** Shortest path using BFS. Returns null if no path exists. */
export declare function shortestPath(adj: AdjMap, from: number, to: number): number[] | null;
/** Ego graph — all nodes within radius hops (both directions). */
export declare function egoGraph(adj: AdjMap, reverseAdj: AdjMap, nodeId: number, radius: number): Set<number>;
export {};
//# sourceMappingURL=graph-traversal.d.ts.map