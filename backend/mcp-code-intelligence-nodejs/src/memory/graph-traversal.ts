/**
 * GraphTraversal — BFS, DFS, shortest path algorithms.
 */

type AdjMap = Map<number, Set<number>>;

/** BFS from start node, returns visited nodes up to maxDepth. */
export function bfs(adj: AdjMap, startId: number, maxDepth: number): number[] {
  const visited: number[] = [];
  const queue: Array<[number, number]> = [[startId, 0]];
  const seen = new Set<number>([startId]);
  while (queue.length > 0) {
    const [node, depth] = queue.shift()!;
    visited.push(node);
    if (depth >= maxDepth) continue;
    for (const neighbor of adj.get(node) ?? []) {
      if (!seen.has(neighbor)) {
        seen.add(neighbor);
        queue.push([neighbor, depth + 1]);
      }
    }
  }
  return visited;
}

/** Shortest path using BFS. Returns null if no path exists. */
export function shortestPath(adj: AdjMap, from: number, to: number): number[] | null {
  if (from === to) return [from];
  const queue: number[] = [from];
  const parent = new Map<number, number>();
  const seen = new Set<number>([from]);
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const neighbor of adj.get(node) ?? []) {
      if (seen.has(neighbor)) continue;
      parent.set(neighbor, node);
      if (neighbor === to) return reconstructPath(parent, from, to);
      seen.add(neighbor);
      queue.push(neighbor);
    }
  }
  return null;
}

/** Ego graph — all nodes within radius hops (both directions). */
export function egoGraph(
  adj: AdjMap, reverseAdj: AdjMap, nodeId: number, radius: number
): Set<number> {
  const result = new Set<number>([nodeId]);
  const queue: Array<[number, number]> = [[nodeId, 0]];
  while (queue.length > 0) {
    const [current, depth] = queue.shift()!;
    if (depth >= radius) continue;
    const forward = adj.get(current) ?? new Set();
    const backward = reverseAdj.get(current) ?? new Set();
    for (const n of [...forward, ...backward]) {
      if (!result.has(n)) {
        result.add(n);
        queue.push([n, depth + 1]);
      }
    }
  }
  return result;
}

function reconstructPath(parent: Map<number, number>, from: number, to: number): number[] {
  const path = [to];
  let current = to;
  while (current !== from) {
    const p = parent.get(current);
    if (p === undefined) return [];
    path.push(p);
    current = p;
  }
  return path.reverse();
}
