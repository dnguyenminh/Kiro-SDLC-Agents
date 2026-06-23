/**
 * GraphAnalyzer — server-side graph structure analysis for KB.
 * Port of Python graph_analyzer.py.
 */
import Database from 'better-sqlite3';
interface GraphInsight {
    type: string;
    title: string;
    description: string;
    node_ids: number[];
    severity: string;
    action: {
        label: string;
        endpoint: string;
        method: string;
    } | null;
}
interface GraphAnalysisResult {
    insights: GraphInsight[];
    stats: {
        node_count: number;
        edge_count: number;
        density: number;
    };
    computed_at: string;
}
export declare class GraphAnalyzer {
    private readonly db;
    constructor(db: Database.Database);
    analyze(): GraphAnalysisResult;
    private computeStats;
    private findOrphans;
    private findHubs;
    private findClusters;
    private findStaleNodes;
}
export {};
//# sourceMappingURL=graph-analyzer.d.ts.map