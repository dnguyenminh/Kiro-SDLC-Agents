/**
 * KSA-168: Cluster Builder — Union-Find data structure for grouping duplicates.
 * Uses path compression and union by rank for near-O(1) operations.
 */
export declare class ClusterBuilder {
    private parent;
    private rank;
    /** Find the cluster representative (with path compression). */
    find(x: number): number;
    /** Merge two nodes into the same cluster (union by rank). */
    union(a: number, b: number): void;
    /** Get all clusters (groups of 2+ members). */
    getClusters(): Map<number, number[]>;
    /** Check if two nodes are in the same cluster. */
    connected(a: number, b: number): boolean;
    /** Get total number of distinct clusters. */
    getClusterCount(): number;
}
