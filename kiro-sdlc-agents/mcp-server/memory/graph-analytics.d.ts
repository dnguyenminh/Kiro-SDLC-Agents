/**
 * GraphAnalytics — centrality, hubs, connected components analysis.
 */
type AdjMap = Map<number, Set<number>>;
/** Degree centrality — normalized count of connections per node. */
export declare function degreeCentrality(adj: AdjMap): Map<number, number>;
/** Find hub nodes — nodes with degree above threshold. */
export declare function findHubs(adj: AdjMap, minDegree?: number): number[];
/** Find isolated nodes — nodes with no connections. */
export declare function findIsolated(adj: AdjMap): number[];
/** Connected components using BFS. */
export declare function connectedComponents(adj: AdjMap): Set<number>[];
/** Graph density — ratio of actual edges to possible edges. */
export declare function density(nodeCount: number, edgeCount: number): number;
export {};
//# sourceMappingURL=graph-analytics.d.ts.map