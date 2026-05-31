"use strict";
/**
 * KSA-168: Cluster Builder — Union-Find data structure for grouping duplicates.
 * Uses path compression and union by rank for near-O(1) operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClusterBuilder = void 0;
class ClusterBuilder {
    parent = new Map();
    rank = new Map();
    /** Find the cluster representative (with path compression). */
    find(x) {
        if (!this.parent.has(x)) {
            this.parent.set(x, x);
            this.rank.set(x, 0);
        }
        const p = this.parent.get(x);
        if (p !== x) {
            const root = this.find(p);
            this.parent.set(x, root);
            return root;
        }
        return x;
    }
    /** Merge two nodes into the same cluster (union by rank). */
    union(a, b) {
        const rootA = this.find(a);
        const rootB = this.find(b);
        if (rootA === rootB)
            return;
        const rankA = this.rank.get(rootA) ?? 0;
        const rankB = this.rank.get(rootB) ?? 0;
        if (rankA < rankB) {
            this.parent.set(rootA, rootB);
        }
        else if (rankA > rankB) {
            this.parent.set(rootB, rootA);
        }
        else {
            this.parent.set(rootB, rootA);
            this.rank.set(rootA, rankA + 1);
        }
    }
    /** Get all clusters (groups of 2+ members). */
    getClusters() {
        const clusters = new Map();
        for (const node of this.parent.keys()) {
            const root = this.find(node);
            if (!clusters.has(root))
                clusters.set(root, []);
            clusters.get(root).push(node);
        }
        // Filter to clusters with 2+ members
        for (const [root, members] of clusters) {
            if (members.length < 2)
                clusters.delete(root);
        }
        return clusters;
    }
    /** Check if two nodes are in the same cluster. */
    connected(a, b) {
        return this.find(a) === this.find(b);
    }
    /** Get total number of distinct clusters. */
    getClusterCount() {
        return this.getClusters().size;
    }
}
exports.ClusterBuilder = ClusterBuilder;
//# sourceMappingURL=ClusterBuilder.js.map