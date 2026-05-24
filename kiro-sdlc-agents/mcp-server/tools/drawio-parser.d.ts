/**
 * Parses draw.io XML into graph nodes and edges for layout processing.
 * Uses regex-based parsing (no external XML deps needed for draw.io format).
 */
export interface DiagramNode {
    id: string;
    parentId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    style: string;
    isContainer: boolean;
}
export interface DiagramEdge {
    id: string;
    sourceId: string;
    targetId: string;
    style: string;
}
export interface DiagramGraph {
    nodes: DiagramNode[];
    edges: DiagramEdge[];
    containers: DiagramNode[];
}
/** Parse .drawio XML file into DiagramGraph. */
export declare function parseDrawio(filePath: string): {
    raw: string;
    graph: DiagramGraph;
};
//# sourceMappingURL=drawio-parser.d.ts.map