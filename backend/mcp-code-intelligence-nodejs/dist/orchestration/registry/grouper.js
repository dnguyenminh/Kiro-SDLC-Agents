"use strict";
/**
 * Semantic grouper — builds fallback chains by grouping tools with similar functionality.
 * Two strategies: exact name match + Jaccard description similarity.
 * Behavioral parity with Kotlin SemanticGrouper.kt.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticGrouper = void 0;
class SemanticGrouper {
    threshold;
    constructor(threshold = 0.7) {
        this.threshold = threshold;
    }
    /** Build all chains from registered tools. */
    buildChains(tools) {
        const chains = new Map();
        this.buildExactNameChains(tools, chains);
        this.buildSemanticChains(tools, chains);
        return chains;
    }
    /** Weighted Jaccard similarity between two tools. */
    computeSimilarity(a, b) {
        const tokensA = new Set([...a.nameTokens, ...a.descTokens]);
        const tokensB = new Set([...b.nameTokens, ...b.descTokens]);
        if (tokensA.size === 0 || tokensB.size === 0)
            return 0.0;
        const intersection = [...tokensA].filter((t) => tokensB.has(t));
        const union = new Set([...tokensA, ...tokensB]);
        const jaccard = intersection.length / union.size;
        const nameOverlap = [...a.nameTokens].filter((t) => b.nameTokens.has(t)).length;
        return Math.min(1.0, jaccard + nameOverlap * 0.1);
    }
    buildExactNameChains(tools, chains) {
        const grouped = new Map();
        for (const tool of tools) {
            const list = grouped.get(tool.name) ?? [];
            list.push(tool);
            grouped.set(tool.name, list);
        }
        for (const [name, group] of grouped) {
            if (group.length < 2)
                continue;
            const entries = group
                .map((t) => ({ serverName: t.source.replace(/^child:/, ''), priority: t.priority, toolName: t.name }))
                .sort((a, b) => a.priority - b.priority);
            chains.set(name, { toolName: name, entries, groupingReason: 'exact_name', similarNames: new Set() });
        }
    }
    buildSemanticChains(tools, chains) {
        const ungrouped = tools.filter((t) => !chains.has(t.name));
        const paired = new Set();
        for (let i = 0; i < ungrouped.length; i++) {
            if (paired.has(ungrouped[i].name))
                continue;
            for (let j = i + 1; j < ungrouped.length; j++) {
                if (paired.has(ungrouped[j].name))
                    continue;
                const sim = this.computeSimilarity(ungrouped[i], ungrouped[j]);
                if (sim >= this.threshold) {
                    this.mergeIntoChain(ungrouped[i], ungrouped[j], sim, chains);
                    paired.add(ungrouped[i].name);
                    paired.add(ungrouped[j].name);
                }
            }
        }
    }
    mergeIntoChain(a, b, sim, chains) {
        const canonical = a.priority <= b.priority ? a : b;
        const other = a.priority <= b.priority ? b : a;
        const entries = [
            { serverName: canonical.source.replace(/^child:/, ''), priority: canonical.priority, toolName: canonical.name },
            { serverName: other.source.replace(/^child:/, ''), priority: other.priority, toolName: other.name },
        ].sort((x, y) => x.priority - y.priority);
        const reason = `semantic_similarity:${sim.toFixed(2)}`;
        const chain = { toolName: canonical.name, entries, groupingReason: reason, similarNames: new Set([other.name]) };
        chains.set(canonical.name, chain);
        chains.set(other.name, chain);
        console.error(`[SemanticGrouper] Grouped '${canonical.name}' + '${other.name}' (sim=${sim.toFixed(2)})`);
    }
}
exports.SemanticGrouper = SemanticGrouper;
//# sourceMappingURL=grouper.js.map