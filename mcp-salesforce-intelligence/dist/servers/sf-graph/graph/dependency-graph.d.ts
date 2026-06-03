/**
 * In-memory dependency graph data structure.
 * Supports forward/reverse traversal, cycle detection, and export.
 */
import type { GraphNode, GraphEdge, MetadataType, RelationType, DependencyResult, ImpactResult } from '../../../shared/types.js';
export declare class DependencyGraph {
    private nodes;
    private edges;
    private adjacencyOut;
    private adjacencyIn;
    addNode(node: GraphNode): void;
    addEdge(source: string, target: string, relationship: RelationType): void;
    getNode(id: string): GraphNode | undefined;
    getNodeType(id: string): MetadataType;
    getOutgoingEdges(nodeId: string): GraphEdge[];
    getIncomingEdges(nodeId: string): GraphEdge[];
    getForwardDeps(name: string, maxDepth?: number, types?: string[]): DependencyResult;
    getReverseDeps(name: string, maxDepth?: number, types?: string[]): DependencyResult;
    getImpact(name: string, maxDepth?: number): ImpactResult;
    detectCycles(): string[][];
    exportJSON(types?: string[]): {
        nodes: GraphNode[];
        edges: GraphEdge[];
    };
    exportDOT(types?: string[]): string;
    getAllNodes(): GraphNode[];
    getAllEdges(): GraphEdge[];
    get nodeCount(): number;
    get edgeCount(): number;
    get isEmpty(): boolean;
    clear(): void;
}
//# sourceMappingURL=dependency-graph.d.ts.map