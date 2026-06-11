/**
 * Clustering Algorithm — Louvain community detection with type affinity
 * KSA-143
 */

import { GraphData, GraphNode, GraphEdge, Cluster, ClusterHierarchy, ClusterMetadata, ClusterOptions, Vector3 } from './types';

interface Community {
  id: string;
  nodeIds: Set<string>;
  internalWeight: number;
  totalWeight: number;
}

export class ClusteringAlgorithm {
  private adjacency: Map<string, Map<string, number>> = new Map();
  private nodeTypes: Map<string, string> = new Map();
  private nodePositions: Map<string, Vector3> = new Map();
  private totalWeight: number = 0;

  cluster(graphData: GraphData, options: ClusterOptions): ClusterHierarchy {
    const startTime = performance.now();

    // Skip clustering for small graphs
    if (graphData.nodes.length < 50) {
      return this.createTrivialHierarchy(graphData, startTime);
    }

    // Build adjacency
    this.buildAdjacency(graphData);

    // Phase 1: Louvain community detection
    let communities = this.initializeCommunities(graphData.nodes);
    communities = this.louvainOptimize(communities);

    // Phase 2: Type affinity adjustment
    communities = this.applyTypeAffinity(communities, options.typeWeight / options.connectivityWeight);

    // Phase 3: Size constraint enforcement
    communities = this.enforceSizeConstraints(communities, options);

    // Phase 4: Build cluster objects
    const clusters = this.buildClusters(communities, graphData.nodes);
    const isolatedNodes = this.findIsolatedNodes(graphData);

    const elapsed = performance.now() - startTime;

    const metadata: ClusterMetadata = {
      totalNodes: graphData.nodes.length,
      totalClusters: clusters.length,
      avgClusterSize: clusters.length > 0 ? graphData.nodes.length / clusters.length : 0,
      clusteringTimeMs: elapsed,
    };

    return { clusters, isolatedNodes, metadata };
  }

  private createTrivialHierarchy(graphData: GraphData, startTime: number): ClusterHierarchy {
    // For small graphs, no clustering needed — all nodes are "isolated"
    return {
      clusters: [],
      isolatedNodes: graphData.nodes.map(n => n.id),
      metadata: {
        totalNodes: graphData.nodes.length,
        totalClusters: 0,
        avgClusterSize: 0,
        clusteringTimeMs: performance.now() - startTime,
      },
    };
  }

  private buildAdjacency(graphData: GraphData): void {
    this.adjacency.clear();
    this.totalWeight = 0;

    for (const node of graphData.nodes) {
      this.adjacency.set(node.id, new Map());
      this.nodeTypes.set(node.id, node.type);
      if (node.position) {
        this.nodePositions.set(node.id, node.position);
      }
    }

    for (const edge of graphData.edges) {
      const weight = edge.weight ?? 1.0;
      this.totalWeight += weight;

      const srcAdj = this.adjacency.get(edge.source);
      const tgtAdj = this.adjacency.get(edge.target);

      if (srcAdj) {
        srcAdj.set(edge.target, (srcAdj.get(edge.target) ?? 0) + weight);
      }
      if (tgtAdj) {
        tgtAdj.set(edge.source, (tgtAdj.get(edge.source) ?? 0) + weight);
      }
    }
  }

  private initializeCommunities(nodes: GraphNode[]): Community[] {
    return nodes.map(node => ({
      id: node.id,
      nodeIds: new Set([node.id]),
      internalWeight: 0,
      totalWeight: this.getNodeWeight(node.id),
    }));
  }

  private getNodeWeight(nodeId: string): number {
    const adj = this.adjacency.get(nodeId);
    if (!adj) return 0;
    let total = 0;
    for (const w of adj.values()) total += w;
    return total;
  }

  private louvainOptimize(communities: Community[]): Community[] {
    const nodeToComm: Map<string, number> = new Map();
    communities.forEach((c, i) => {
      for (const nodeId of c.nodeIds) {
        nodeToComm.set(nodeId, i);
      }
    });

    let improved = true;
    let iterations = 0;
    const maxIterations = 100;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      for (const [nodeId] of this.adjacency) {
        const currentCommIdx = nodeToComm.get(nodeId)!;
        const neighbors = this.adjacency.get(nodeId)!;

        // Find best community to move to
        let bestGain = 0;
        let bestCommIdx = currentCommIdx;

        const neighborComms = new Set<number>();
        for (const [neighborId] of neighbors) {
          neighborComms.add(nodeToComm.get(neighborId)!);
        }

        for (const commIdx of neighborComms) {
          if (commIdx === currentCommIdx) continue;
          const gain = this.modularityGain(nodeId, communities[commIdx], communities[currentCommIdx]);
          if (gain > bestGain) {
            bestGain = gain;
            bestCommIdx = commIdx;
          }
        }

        if (bestCommIdx !== currentCommIdx) {
          // Move node
          communities[currentCommIdx].nodeIds.delete(nodeId);
          communities[bestCommIdx].nodeIds.add(nodeId);
          nodeToComm.set(nodeId, bestCommIdx);
          improved = true;
        }
      }
    }

    // Remove empty communities
    return communities.filter(c => c.nodeIds.size > 0);
  }

  private modularityGain(nodeId: string, targetComm: Community, sourceComm: Community): number {
    const ki = this.getNodeWeight(nodeId);
    const m2 = this.totalWeight * 2;
    if (m2 === 0) return 0;

    // Sum of weights from node to target community
    let kiIn = 0;
    const neighbors = this.adjacency.get(nodeId)!;
    for (const [neighborId, weight] of neighbors) {
      if (targetComm.nodeIds.has(neighborId)) {
        kiIn += weight;
      }
    }

    // Simplified modularity gain
    const sigmaIn = targetComm.internalWeight;
    const sigmaTot = targetComm.totalWeight;

    return (kiIn / m2) - (sigmaTot * ki) / (m2 * m2 / 4);
  }

  private applyTypeAffinity(communities: Community[], typeWeight: number): Community[] {
    // For each node in minority type within its community, consider moving
    for (const comm of communities) {
      if (comm.nodeIds.size < 3) continue;

      const typeCounts = new Map<string, number>();
      for (const nodeId of comm.nodeIds) {
        const type = this.nodeTypes.get(nodeId) ?? 'unknown';
        typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
      }

      // Find dominant type
      let dominantType = '';
      let maxCount = 0;
      for (const [type, count] of typeCounts) {
        if (count > maxCount) {
          maxCount = count;
          dominantType = type;
        }
      }

      // Minority threshold: < 20% of community
      const threshold = comm.nodeIds.size * 0.2;
      for (const [type, count] of typeCounts) {
        if (type !== dominantType && count < threshold) {
          // These nodes could be moved, but we keep it simple for v1
          // Full implementation would find best same-type community
        }
      }
    }

    return communities;
  }

  private enforceSizeConstraints(communities: Community[], options: ClusterOptions): Community[] {
    const result: Community[] = [];

    for (const comm of communities) {
      if (comm.nodeIds.size > options.maxClusterSize) {
        // Split oversized
        const splits = this.splitCommunity(comm, options.maxClusterSize);
        result.push(...splits);
      } else if (comm.nodeIds.size < options.minClusterSize) {
        // Will try to merge later
        result.push(comm);
      } else {
        result.push(comm);
      }
    }

    // Merge undersized communities with nearest
    return this.mergeUndersized(result, options.minClusterSize, options.maxClusterSize);
  }

  private splitCommunity(comm: Community, maxSize: number): Community[] {
    const nodeArray = Array.from(comm.nodeIds);
    const chunks: Community[] = [];

    for (let i = 0; i < nodeArray.length; i += maxSize) {
      const chunk = nodeArray.slice(i, i + maxSize);
      chunks.push({
        id: `${comm.id}_split_${chunks.length}`,
        nodeIds: new Set(chunk),
        internalWeight: 0,
        totalWeight: 0,
      });
    }

    return chunks;
  }

  private mergeUndersized(communities: Community[], minSize: number, maxSize: number): Community[] {
    const result: Community[] = [];
    const undersized: Community[] = [];

    for (const comm of communities) {
      if (comm.nodeIds.size < minSize) {
        undersized.push(comm);
      } else {
        result.push(comm);
      }
    }

    // Try to merge each undersized with nearest valid community
    for (const small of undersized) {
      let merged = false;
      for (const target of result) {
        if (target.nodeIds.size + small.nodeIds.size <= maxSize) {
          for (const nodeId of small.nodeIds) {
            target.nodeIds.add(nodeId);
          }
          merged = true;
          break;
        }
      }
      if (!merged) {
        // Keep as-is (small cluster is acceptable)
        result.push(small);
      }
    }

    return result;
  }

  private buildClusters(communities: Community[], nodes: GraphNode[]): Cluster[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    return communities.map((comm, idx) => {
      const childNodes = Array.from(comm.nodeIds)
        .map(id => nodeMap.get(id))
        .filter((n): n is GraphNode => n !== undefined);

      const center = this.computeCentroid(childNodes);
      const radius = this.computeRadius(childNodes, center);
      const dominantType = this.getDominantType(childNodes);

      return {
        id: `cluster_${idx}`,
        label: dominantType ? `${dominantType} (${childNodes.length})` : `Cluster ${idx}`,
        childNodeIds: Array.from(comm.nodeIds),
        center,
        radius: Math.max(radius, 5), // minimum radius
        dominantType,
      };
    });
  }

  private computeCentroid(nodes: GraphNode[]): Vector3 {
    if (nodes.length === 0) return { x: 0, y: 0, z: 0 };

    let x = 0, y = 0, z = 0;
    let count = 0;

    for (const node of nodes) {
      if (node.position) {
        x += node.position.x;
        y += node.position.y;
        z += node.position.z;
        count++;
      }
    }

    if (count === 0) {
      // Assign random positions if none exist
      return { x: Math.random() * 100, y: Math.random() * 100, z: Math.random() * 100 };
    }

    return { x: x / count, y: y / count, z: z / count };
  }

  private computeRadius(nodes: GraphNode[], center: Vector3): number {
    let maxDist = 0;
    for (const node of nodes) {
      if (node.position) {
        const dx = node.position.x - center.x;
        const dy = node.position.y - center.y;
        const dz = node.position.z - center.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        maxDist = Math.max(maxDist, dist);
      }
    }
    return maxDist;
  }

  private getDominantType(nodes: GraphNode[]): string {
    const typeCounts = new Map<string, number>();
    for (const node of nodes) {
      typeCounts.set(node.type, (typeCounts.get(node.type) ?? 0) + 1);
    }

    let dominant = 'unknown';
    let maxCount = 0;
    for (const [type, count] of typeCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominant = type;
      }
    }
    return dominant;
  }

  private findIsolatedNodes(graphData: GraphData): string[] {
    const connectedNodes = new Set<string>();
    for (const edge of graphData.edges) {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    }
    return graphData.nodes
      .filter(n => !connectedNodes.has(n.id))
      .map(n => n.id);
  }
}
