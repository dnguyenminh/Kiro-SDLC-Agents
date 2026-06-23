/**
 * KSA-163: Tarjan's Strongly Connected Components algorithm.
 * Finds all cycles in a directed graph.
 */
import type { AdjacencyList } from '../types.js';
export declare class TarjanSCC {
    private index;
    private stack;
    private indices;
    private lowlinks;
    private onStack;
    private sccs;
    /** Find all strongly connected components with size > 1 (cycles). */
    findSCCs(graph: AdjacencyList): number[][];
    private strongConnect;
    private reset;
}
//# sourceMappingURL=TarjanSCC.d.ts.map