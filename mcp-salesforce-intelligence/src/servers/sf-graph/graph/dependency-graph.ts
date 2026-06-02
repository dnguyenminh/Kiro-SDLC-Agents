/**
 * In-memory dependency graph data structure.
 * Supports forward/reverse traversal, cycle detection, and export.
 */

import type { GraphNode, GraphEdge, MetadataType, RelationType, DependencyResult, ImpactResult } from '../../../shared/types.js';

export class DependencyGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private adjacencyOut: Map<string, GraphEdge[]> = new Map();
  private adjacencyIn: Map<string, GraphEdge[]> = new Map();

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacencyOut.has(node.id)) this.adjacencyOut.set(node.id, []);
    if (!this.adjacencyIn.has(node.id)) this.adjacencyIn.set(node.id, []);
  }

  addEdge(source: string, target: string, relationship: RelationType): void {
    const edge: GraphEdge = { source, target, relationship };
    this.edges.push(edge);
    if (!this.adjacencyOut.has(source)) this.adjacencyOut.set(source, []);
    this.adjacencyOut.get(source)!.push(edge);
    if (!this.adjacencyIn.has(target)) this.adjacencyIn.set(target, []);
    this.adjacencyIn.get(target)!.push(edge);
  }

  getNode(id: string): GraphNode | undefined { return this.nodes.get(id); }
  getNodeType(id: string): MetadataType { return this.nodes.get(id)?.type ?? 'Other'; }
  getOutgoingEdges(nodeId: string): GraphEdge[] { return this.adjacencyOut.get(nodeId) ?? []; }
  getIncomingEdges(nodeId: string): GraphEdge[] { return this.adjacencyIn.get(nodeId) ?? []; }

  getForwardDeps(name: string, maxDepth: number = 3, types?: string[]): DependencyResult {
    const nodeType = this.getNodeType(name);
    const visited = new Set<string>();
    const deps: Array<{ name: string; type: MetadataType; relationship: RelationType; depth: number }> = [];
    const circularRefs: string[] = [];
    const queue: Array<{ node: string; depth: number; path: string[] }> = [{ node: name, depth: 0, path: [name] }];

    while (queue.length > 0) {
      const { node, depth, path } = queue.shift()!;
      if (depth > 0) visited.add(node);
      if (depth >= maxDepth) continue;

      for (const edge of this.getOutgoingEdges(node)) {
        if (path.includes(edge.target)) { circularRefs.push([...path, edge.target].join(' -> ')); continue; }
        if (visited.has(edge.target)) continue;
        const targetType = this.getNodeType(edge.target);
        if (types && types.length > 0 && !types.includes(targetType)) continue;
        deps.push({ name: edge.target, type: targetType, relationship: edge.relationship, depth: depth + 1 });
        queue.push({ node: edge.target, depth: depth + 1, path: [...path, edge.target] });
      }
    }
    return { node: name, node_type: nodeType, dependencies: deps, circular_refs: circularRefs, total_count: deps.length };
  }

  getReverseDeps(name: string, maxDepth: number = 3, types?: string[]): DependencyResult {
    const nodeType = this.getNodeType(name);
    const visited = new Set<string>();
    const deps: Array<{ name: string; type: MetadataType; relationship: RelationType; depth: number }> = [];
    const circularRefs: string[] = [];
    const queue: Array<{ node: string; depth: number; path: string[] }> = [{ node: name, depth: 0, path: [name] }];

    while (queue.length > 0) {
      const { node, depth, path } = queue.shift()!;
      if (depth > 0) visited.add(node);
      if (depth >= maxDepth) continue;

      for (const edge of this.getIncomingEdges(node)) {
        if (path.includes(edge.source)) { circularRefs.push([...path, edge.source].join(' -> ')); continue; }
        if (visited.has(edge.source)) continue;
        const sourceType = this.getNodeType(edge.source);
        if (types && types.length > 0 && !types.includes(sourceType)) continue;
        deps.push({ name: edge.source, type: sourceType, relationship: edge.relationship, depth: depth + 1 });
        queue.push({ node: edge.source, depth: depth + 1, path: [...path, edge.source] });
      }
    }
    return { node: name, node_type: nodeType, dependencies: deps, circular_refs: circularRefs, total_count: deps.length };
  }

  getImpact(name: string, maxDepth: number = 3): ImpactResult {
    const visited = new Set<string>([name]);
    const directImpact: Array<{ name: string; type: MetadataType; relationship: RelationType }> = [];
    const indirectImpact: Array<{ name: string; type: MetadataType; depth: number; path: string[] }> = [];
    const circularRefs: string[] = [];
    const byType: Record<string, number> = {};
    const queue: Array<{ node: string; depth: number; path: string[] }> = [{ node: name, depth: 0, path: [name] }];

    while (queue.length > 0) {
      const { node, depth, path } = queue.shift()!;
      if (depth >= maxDepth) continue;

      for (const edge of this.getIncomingEdges(node)) {
        if (path.includes(edge.source)) { circularRefs.push([...path, edge.source].join(' -> ')); continue; }
        if (visited.has(edge.source)) continue;
        visited.add(edge.source);
        const sourceType = this.getNodeType(edge.source);
        byType[sourceType] = (byType[sourceType] ?? 0) + 1;

        if (depth + 1 === 1) {
          directImpact.push({ name: edge.source, type: sourceType, relationship: edge.relationship });
        } else {
          indirectImpact.push({ name: edge.source, type: sourceType, depth: depth + 1, path: [...path, edge.source] });
        }
        queue.push({ node: edge.source, depth: depth + 1, path: [...path, edge.source] });
      }
    }

    return { node: name, total_impacted: directImpact.length + indirectImpact.length, direct_impact: directImpact, indirect_impact: indirectImpact, by_type: byType, circular_refs: circularRefs };
  }

  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (node: string, path: string[]) => {
      if (stack.has(node)) {
        const idx = path.indexOf(node);
        if (idx >= 0) cycles.push(path.slice(idx));
        return;
      }
      if (visited.has(node)) return;
      visited.add(node);
      stack.add(node);
      path.push(node);
      for (const edge of this.getOutgoingEdges(node)) { dfs(edge.target, [...path]); }
      stack.delete(node);
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) dfs(nodeId, []);
    }
    return cycles;
  }

  exportJSON(types?: string[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
    let nodes = [...this.nodes.values()];
    let edges = [...this.edges];
    if (types && types.length > 0) {
      const typeSet = new Set(types);
      nodes = nodes.filter(n => typeSet.has(n.type));
      const nodeIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    }
    return { nodes, edges };
  }

  exportDOT(types?: string[]): string {
    const { nodes, edges } = this.exportJSON(types);
    const lines: string[] = ['digraph SalesforceDependencies {', '  rankdir=LR;', '  node [shape=box];', ''];
    for (const node of nodes) { lines.push(`  "${node.id}" [label="${node.label}\\n(${node.type})"];`); }
    lines.push('');
    for (const edge of edges) { lines.push(`  "${edge.source}" -> "${edge.target}" [label="${edge.relationship}"];`); }
    lines.push('}');
    return lines.join('\n');
  }

  getAllNodes(): GraphNode[] { return [...this.nodes.values()]; }
  getAllEdges(): GraphEdge[] { return [...this.edges]; }
  get nodeCount(): number { return this.nodes.size; }
  get edgeCount(): number { return this.edges.length; }
  get isEmpty(): boolean { return this.nodes.size === 0; }
  clear(): void { this.nodes.clear(); this.edges = []; this.adjacencyOut.clear(); this.adjacencyIn.clear(); }
}
