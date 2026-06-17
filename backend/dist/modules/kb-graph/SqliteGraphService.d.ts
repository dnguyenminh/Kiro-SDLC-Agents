/**
 * SqliteGraphService — Embedded graph layer using SQLite for KB Graph visualization.
 *
 * Zero external dependencies — uses the existing admin.db with graph_nodes + graph_edges tables.
 * Provides spatial bounding-box queries for progressive 3D loading.
 * New KB entries auto-get 3D positions computed via Fibonacci sphere layout.
 */
import type { Logger } from 'pino';
export interface SpatialQueryParams {
    camX: number;
    camY: number;
    camZ: number;
    zoom: number;
}
export interface GraphNode {
    id: string;
    label: string;
    type: string;
    tier: string;
    x: number;
    y: number;
    z: number;
    level: number;
    clusterId: string | null;
}
export interface GraphEdge {
    source: string;
    target: string;
    weight: number;
    type: string;
}
export interface SpatialGraphResult {
    nodes: GraphNode[];
    edges: GraphEdge[];
    stats: {
        totalNodes: number;
        totalEdges: number;
        queryTimeMs: number;
        level: string;
        totalInDb: number;
        totalEdgesInDb: number;
    };
}
export declare class SqliteGraphService {
    private logger;
    private _ready;
    constructor(logger: Logger);
    get ready(): boolean;
    initialize(): void;
    getNodeCount(): number;
    addNode(entryId: string, label: string, type: string, tier: string): GraphNode;
    removeNode(entryId: string): void;
    getNode(entryId: string): GraphNode | null;
    addEdge(source: string, target: string, weight?: number, relType?: string): void;
    /**
     * Returns ALL node positions (minimal data, no edges) for initial full-load rendering.
     * Optimized for Points-based visualization of 72k+ nodes.
     */
    getAllPositions(): {
        nodes: {
            id: string;
            x: number;
            y: number;
            z: number;
            type: string;
            tier: string;
            label: string;
        }[];
        total: number;
    };
    spatialQuery(params: SpatialQueryParams): SpatialGraphResult;
    syncFromEntries(entries: any[]): {
        nodesCreated: number;
        edgesCreated: number;
    };
    private computePosition;
    private computePositionByIndex;
    private autoCreateEdges;
    private rowToNode;
}
