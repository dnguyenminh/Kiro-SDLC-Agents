/**
 * Builds DependencyGraph from parse results.
 */

import type { GraphNode, GraphEdge, ApexParseResult, FlowParseResult, LWCParseResult, ObjectParseResult, MetadataType, RelationType } from '../../../shared/types.js';
import { DependencyGraph } from './dependency-graph.js';

export class GraphBuilder {
  buildFromParseResults(results: {
    apex?: ApexParseResult[];
    flows?: FlowParseResult[];
    objects?: ObjectParseResult[];
    lwc?: LWCParseResult[];
  }): DependencyGraph {
    const graph = new DependencyGraph();

    if (results.apex) {
      for (const apex of results.apex) {
        const type: MetadataType = apex.type === 'trigger' ? 'ApexTrigger'
          : apex.type === 'interface' ? 'ApexInterface'
          : apex.type === 'enum' ? 'ApexEnum' : 'ApexClass';
        graph.addNode({ id: apex.name, type, label: apex.name, file_path: apex.file_path });
        this.extractApexEdges(apex, graph);
      }
    }

    if (results.flows) {
      for (const flow of results.flows) {
        graph.addNode({ id: flow.name, type: 'Flow', label: flow.name, file_path: flow.file_path });
        this.extractFlowEdges(flow, graph);
      }
    }

    if (results.objects) {
      for (const obj of results.objects) {
        graph.addNode({ id: obj.name, type: 'CustomObject', label: obj.label || obj.name, file_path: obj.file_path });
        this.extractObjectEdges(obj, graph);
      }
    }

    if (results.lwc) {
      for (const lwc of results.lwc) {
        graph.addNode({ id: lwc.name, type: 'LWC', label: lwc.name, file_path: lwc.file_path });
        this.extractLWCEdges(lwc, graph);
      }
    }

    return graph;
  }

  private extractApexEdges(apex: ApexParseResult, graph: DependencyGraph): void {
    if (apex.parent_class) graph.addEdge(apex.name, apex.parent_class, 'extends');
    for (const iface of apex.interfaces) graph.addEdge(apex.name, iface, 'implements');
    for (const ref of apex.dependencies.referenced_classes) {
      if (ref !== apex.name) graph.addEdge(apex.name, ref, 'references');
    }
    for (const dml of apex.dependencies.dml_operations) graph.addEdge(apex.name, dml, 'dml');
    for (const call of apex.dependencies.method_calls) {
      const className = call.split('.')[0];
      if (className && className !== apex.name) graph.addEdge(apex.name, className, 'calls');
    }
    if (apex.trigger_info) graph.addEdge(apex.name, apex.trigger_info.object, 'triggers');
  }

  private extractFlowEdges(flow: FlowParseResult, graph: DependencyGraph): void {
    for (const obj of flow.dependencies.referenced_objects) graph.addEdge(flow.name, obj, 'dml');
    for (const cls of flow.dependencies.referenced_classes) graph.addEdge(flow.name, cls, 'calls');
    for (const subflow of flow.dependencies.referenced_flows) graph.addEdge(flow.name, subflow, 'calls');
  }

  private extractObjectEdges(obj: ObjectParseResult, graph: DependencyGraph): void {
    for (const rel of obj.relationships) graph.addEdge(obj.name, rel.related_to, 'references');
  }

  private extractLWCEdges(lwc: LWCParseResult, graph: DependencyGraph): void {
    for (const apex of lwc.dependencies.apex_classes) graph.addEdge(lwc.name, apex, 'calls');
    for (const child of lwc.dependencies.child_components) {
      const componentName = child.replace('c-', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      graph.addEdge(lwc.name, componentName, 'imports');
    }
  }
}
