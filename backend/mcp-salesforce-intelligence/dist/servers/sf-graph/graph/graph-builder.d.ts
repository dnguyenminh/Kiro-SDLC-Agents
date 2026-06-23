/**
 * Builds DependencyGraph from parse results.
 */
import type { ApexParseResult, FlowParseResult, LWCParseResult, ObjectParseResult } from '../../../shared/types.js';
import { DependencyGraph } from './dependency-graph.js';
export declare class GraphBuilder {
    buildFromParseResults(results: {
        apex?: ApexParseResult[];
        flows?: FlowParseResult[];
        objects?: ObjectParseResult[];
        lwc?: LWCParseResult[];
    }): DependencyGraph;
    private extractApexEdges;
    private extractFlowEdges;
    private extractObjectEdges;
    private extractLWCEdges;
}
//# sourceMappingURL=graph-builder.d.ts.map