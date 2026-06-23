/**
 * GraphAnalytics — centrality, hubs, connected components analysis.
 */

type AdjMap = Map<number, Set<number>>;

/** Degree centrality — normalized count of connections per node. */
export function degreeCentrality(adj: AdjMap): Map<number, number> {
  if (adj.size === 0) return new Map();
  let maxDegree = 0;
  for (const neighbors of adj.values()) {
    if (neighbors.size > maxDegree) maxDegree = neighbors.size;
  }
  if (maxDegree === 0) return new Map([...adj.keys()].map(k => [k, 0]));
  const result = new Map<number, number>();
  for (const [node, neighbors] of adj) {
    result.set(node, neighbors.size / maxDegree);
  }
  return result;
}

/** Find hub nodes — nodes with degree above threshold. */
export function findHubs(adj: AdjMap, minDegree = 3): number[] {
  const hubs: number[] = [];
  for (const [node, neighbors] of adj) {
    if (neighbors.size >= minDegree) hubs.push(node);
  }
  return hubs;
}

/** Find isolated nodes — nodes with no connections. */
export function findIsolated(adj: AdjMap): number[] {
  const isolated: number[] = [];
  for (const [node, neighbors] of adj) {
    if (neighbors.size === 0) isolated.push(node);
  }
  return isolated;
}

/** Connected components using BFS. */
export function connectedComponents(adj: AdjMap): Set<number>[] {
  const visited = new Set<number>();
  const components: Set<number>[] = [];
  for (const node of adj.keys()) {
    if (visited.has(node)) continue;
    const component = new Set<number>();
    const queue: number[] = [node];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.add(current);
      for (const neighbor of adj.get(current) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
}

/** Graph density — ratio of actual edges to possible edges. */
export function density(nodeCount: number, edgeCount: number): number {
  if (nodeCount <= 1) return 0;
  const maxEdges = nodeCount * (nodeCount - 1);
  return edgeCount / maxEdges;
}
