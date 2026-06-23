/**
 * KSA-157: Graph Traverser - generic BFS/DFS engine with edge/node type filtering.
 * Provides the core traversal logic for the code_traverse MCP tool.
 */
import Database from 'better-sqlite3';
import { SymbolResolver } from './symbol-resolver.js';
export interface GraphNode {
    id: number;
    name: string;
    kind: string;
    filePath: string;
    startLine: number;
    _incomingEdgeType?: string;
}
export interface TraverseConfig {
    edgeTypes: string[];
    nodeTypes: string[];
    direction: 'outgoing' | 'incoming' | 'both';
    maxDepth: number;
    maxResults: number;
}
export interface TraverseResultItem {
    node: GraphNode;
    depth: number;
    path: string[];
    edgeType: string;
}
export interface TraverseResponse {
    start: {
        name: string;
        kind: string;
        file: string;
        line: number;
    };
    results: Array<{
        name: string;
        kind: string;
        file: string;
        line: number;
        depth: number;
        edge_type: string;
        source?: string;
    }>;
    metadata: {
        total_traversed: number;
        total_results: number;
        max_depth_reached: number;
        truncated: boolean;
        execution_time_ms: number;
    };
}
export declare class GraphTraverser {
    private db;
    private resolver;
    private workspace;
    constructor(db: Database.Database, resolver: SymbolResolver, workspace: string);
    /** Resolve a symbol identifier to a graph node. */
    resolveNode(identifier: string): GraphNode | null;
    /** BFS traversal from a start node with edge/node type filters. */
    traverse(startNode: GraphNode, config: TraverseConfig): TraverseResultItem[];
    /** Format traversal results into the MCP response format. */
    formatResponse(startNode: GraphNode, results: TraverseResultItem[], includeSource: boolean, sourceLines: number, executionTimeMs: number): TraverseResponse;
    private getNeighbors;
    private getSourceSnippet;
}
