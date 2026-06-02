import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../../src/servers/sf-graph/graph/dependency-graph.js';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
    graph.addNode({ id: 'A', type: 'ApexClass', label: 'A', file_path: 'a.cls' });
    graph.addNode({ id: 'B', type: 'ApexClass', label: 'B', file_path: 'b.cls' });
    graph.addNode({ id: 'C', type: 'CustomObject', label: 'C', file_path: 'c.object' });
    graph.addNode({ id: 'D', type: 'ApexTrigger', label: 'D', file_path: 'd.trigger' });
    graph.addEdge('A', 'B', 'references');
    graph.addEdge('A', 'C', 'dml');
    graph.addEdge('B', 'C', 'soql');
    graph.addEdge('D', 'A', 'calls');
  });

  it('should track node and edge counts', () => {
    expect(graph.nodeCount).toBe(4);
    expect(graph.edgeCount).toBe(4);
  });

  it('should get forward dependencies', () => {
    const result = graph.getForwardDeps('A', 3);
    expect(result.node).toBe('A');
    expect(result.total_count).toBeGreaterThanOrEqual(2);
    expect(result.dependencies.map(d => d.name)).toContain('B');
    expect(result.dependencies.map(d => d.name)).toContain('C');
  });

  it('should get reverse dependencies', () => {
    const result = graph.getReverseDeps('A', 3);
    expect(result.total_count).toBe(1);
    expect(result.dependencies[0].name).toBe('D');
  });

  it('should perform impact analysis', () => {
    const result = graph.getImpact('C', 3);
    expect(result.total_impacted).toBeGreaterThanOrEqual(2);
    expect(result.direct_impact.map(d => d.name)).toContain('A');
    expect(result.direct_impact.map(d => d.name)).toContain('B');
  });

  it('should filter by type', () => {
    const result = graph.getForwardDeps('A', 3, ['CustomObject']);
    expect(result.dependencies.every(d => d.type === 'CustomObject')).toBe(true);
  });

  it('should detect cycles', () => {
    graph.addEdge('C', 'A', 'references');
    const cycles = graph.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should export as JSON', () => {
    const exported = graph.exportJSON();
    expect(exported.nodes.length).toBe(4);
    expect(exported.edges.length).toBe(4);
  });

  it('should export as DOT', () => {
    const dot = graph.exportDOT();
    expect(dot).toContain('digraph');
    expect(dot).toContain('"A"');
    expect(dot).toContain('->');
  });

  it('should filter export by type', () => {
    const exported = graph.exportJSON(['ApexClass']);
    expect(exported.nodes.every(n => n.type === 'ApexClass')).toBe(true);
  });
});
