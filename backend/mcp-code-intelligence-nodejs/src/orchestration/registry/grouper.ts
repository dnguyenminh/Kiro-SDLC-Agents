/**
 * Semantic grouper — builds fallback chains by grouping tools with similar functionality.
 * Two strategies: exact name match + Jaccard description similarity.
 * Behavioral parity with Kotlin SemanticGrouper.kt.
 */

import { tokenize } from './tokenizer.js';

export interface RegisteredTool {
  name: string;
  definition: Record<string, any>;
  source: string;
  priority: number;
  nameTokens: Set<string>;
  descTokens: Set<string>;
}

export interface ChainEntry {
  serverName: string;
  priority: number;
  toolName: string | null;
}

export interface ToolChain {
  toolName: string;
  entries: ChainEntry[];
  groupingReason: string;
  similarNames: Set<string>;
}

export class SemanticGrouper {
  constructor(private threshold: number = 0.7) {}

  /** Build all chains from registered tools. */
  buildChains(tools: RegisteredTool[]): Map<string, ToolChain> {
    const chains = new Map<string, ToolChain>();
    this.buildExactNameChains(tools, chains);
    this.buildSemanticChains(tools, chains);
    return chains;
  }

  /** Weighted Jaccard similarity between two tools. */
  computeSimilarity(a: RegisteredTool, b: RegisteredTool): number {
    const tokensA = new Set([...a.nameTokens, ...a.descTokens]);
    const tokensB = new Set([...b.nameTokens, ...b.descTokens]);
    if (tokensA.size === 0 || tokensB.size === 0) return 0.0;
    const intersection = [...tokensA].filter((t) => tokensB.has(t));
    const union = new Set([...tokensA, ...tokensB]);
    const jaccard = intersection.length / union.size;
    const nameOverlap = [...a.nameTokens].filter((t) => b.nameTokens.has(t)).length;
    return Math.min(1.0, jaccard + nameOverlap * 0.1);
  }

  private buildExactNameChains(tools: RegisteredTool[], chains: Map<string, ToolChain>): void {
    const grouped = new Map<string, RegisteredTool[]>();
    for (const tool of tools) {
      const list = grouped.get(tool.name) ?? [];
      list.push(tool);
      grouped.set(tool.name, list);
    }
    for (const [name, group] of grouped) {
      if (group.length < 2) continue;
      const entries: ChainEntry[] = group
        .map((t) => ({ serverName: t.source.replace(/^child:/, ''), priority: t.priority, toolName: t.name }))
        .sort((a, b) => a.priority - b.priority);
      chains.set(name, { toolName: name, entries, groupingReason: 'exact_name', similarNames: new Set() });
    }
  }

  private buildSemanticChains(tools: RegisteredTool[], chains: Map<string, ToolChain>): void {
    const ungrouped = tools.filter((t) => !chains.has(t.name));
    const paired = new Set<string>();
    for (let i = 0; i < ungrouped.length; i++) {
      if (paired.has(ungrouped[i].name)) continue;
      for (let j = i + 1; j < ungrouped.length; j++) {
        if (paired.has(ungrouped[j].name)) continue;
        const sim = this.computeSimilarity(ungrouped[i], ungrouped[j]);
        if (sim >= this.threshold) {
          this.mergeIntoChain(ungrouped[i], ungrouped[j], sim, chains);
          paired.add(ungrouped[i].name);
          paired.add(ungrouped[j].name);
        }
      }
    }
  }

  private mergeIntoChain(a: RegisteredTool, b: RegisteredTool, sim: number, chains: Map<string, ToolChain>): void {
    const canonical = a.priority <= b.priority ? a : b;
    const other = a.priority <= b.priority ? b : a;
    const entries: ChainEntry[] = [
      { serverName: canonical.source.replace(/^child:/, ''), priority: canonical.priority, toolName: canonical.name },
      { serverName: other.source.replace(/^child:/, ''), priority: other.priority, toolName: other.name },
    ].sort((x, y) => x.priority - y.priority);
    const reason = `semantic_similarity:${sim.toFixed(2)}`;
    const chain: ToolChain = { toolName: canonical.name, entries, groupingReason: reason, similarNames: new Set([other.name]) };
    chains.set(canonical.name, chain);
    chains.set(other.name, chain);
    console.error(`[SemanticGrouper] Grouped '${canonical.name}' + '${other.name}' (sim=${sim.toFixed(2)})`);
  }
}
