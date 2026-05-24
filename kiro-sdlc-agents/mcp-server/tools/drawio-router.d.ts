/**
 * Orthogonal edge routing — computes waypoints so connectors avoid shapes.
 */
import { DiagramGraph } from './drawio-parser.js';
export interface Waypoint {
    x: number;
    y: number;
}
/** Route all edges, returning map of edge_id → waypoints for edges needing routing. */
export declare function routeEdges(graph: DiagramGraph): Map<string, Waypoint[]>;
//# sourceMappingURL=drawio-router.d.ts.map