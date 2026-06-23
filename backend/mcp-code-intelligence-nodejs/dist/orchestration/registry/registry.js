"use strict";
/**
 * Unified registry — merges native + child server tools into a searchable index.
 * Supports fallback chains, tokenized search, hit tracking, and session toggles.
 * Behavioral parity with Kotlin UnifiedRegistry.kt.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedRegistry = void 0;
const tokenizer_js_1 = require("./tokenizer.js");
const grouper_js_1 = require("./grouper.js");
const META_TOOL_NAMES = new Set([
    'find_tools', 'execute_dynamic_tool', 'toggle_tool',
    'reset_tools', 'manage_auto_approve', 'orchestration_status', 'agent_log',
]);
class UnifiedRegistry {
    similarityThreshold;
    nativeTools = [];
    childTools = [];
    merged = [];
    toggles = new Map();
    chains = new Map();
    serverOrder = [];
    hits = new Map();
    constructor(similarityThreshold = 0.7) {
        this.similarityThreshold = similarityThreshold;
    }
    setServerOrder(order) { this.serverOrder = order; }
    /** Register tools from a child server (filters meta-tools). */
    setChildTools(serverName, tools) {
        const filtered = tools.filter((t) => !META_TOOL_NAMES.has(t.name ?? ''));
        const priority = this.serverOrder.indexOf(serverName);
        const prio = priority < 0 ? 999 : priority;
        this.childTools = this.childTools.filter((t) => t.source !== `child:${serverName}`);
        for (const defn of filtered) {
            const name = defn.name ?? 'unknown';
            const desc = defn.description ?? '';
            this.childTools.push({
                name, definition: defn, source: `child:${serverName}`,
                priority: prio, nameTokens: (0, tokenizer_js_1.tokenize)(name), descTokens: (0, tokenizer_js_1.tokenize)(desc),
            });
        }
        this.rebuild();
    }
    /** Tokenized search — scores by relevance + popularity. */
    search(query) {
        const terms = (0, tokenizer_js_1.tokenize)(query);
        if (terms.size === 0)
            return this.merged.filter((t) => this.isEnabled(t.name));
        const maxHits = Math.max(1, ...this.merged.map((t) => this.hits.get(t.name) ?? 0));
        const scored = [];
        for (const tool of this.merged) {
            if (!this.isEnabled(tool.name))
                continue;
            const score = this.combinedScore(tool, terms, maxHits);
            if (score > 0)
                scored.push([tool, score]);
        }
        scored.sort((a, b) => b[1] - a[1]);
        return scored.map(([t]) => t);
    }
    find(name) {
        return this.merged.find((t) => t.name === name && this.isEnabled(t.name)) ?? null;
    }
    /** Compute deterministic hash of current tool registry state. */
    versionHash() {
        const names = this.merged.map((t) => t.name).sort().join('|');
        let hash = 0;
        for (let i = 0; i < names.length; i++) {
            hash = ((hash << 5) - hash + names.charCodeAt(i)) | 0;
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
    getChain(toolName) { return this.chains.get(toolName) ?? null; }
    recordHit(toolName, weight = 1) {
        const current = this.hits.get(toolName) ?? 0;
        this.hits.set(toolName, current + weight);
        if (current + weight > 1000)
            this.applyDecay(toolName);
    }
    toggle(toolName, enabled) { this.toggles.set(toolName, enabled); }
    resetToggles() { this.toggles.clear(); }
    isEnabled(toolName) { return this.toggles.get(toolName) ?? true; }
    getAll() { return this.merged.filter((t) => this.isEnabled(t.name)).map((t) => t.definition); }
    childToolsByServer() {
        const result = new Map();
        for (const t of this.childTools) {
            const list = result.get(t.source) ?? [];
            list.push(t.name);
            result.set(t.source, list);
        }
        return result;
    }
    allChildTools() { return [...this.childTools]; }
    /** Register a tool discovered via nested find_tools delegation. */
    registerNested(uniqueName, serverName, definition) {
        const desc = definition.description ?? '';
        const tool = {
            name: uniqueName,
            definition,
            source: `child:${serverName}`,
            priority: this.serverOrder.indexOf(serverName) < 0 ? 999 : this.serverOrder.indexOf(serverName),
            nameTokens: (0, tokenizer_js_1.tokenize)(uniqueName),
            descTokens: (0, tokenizer_js_1.tokenize)(desc),
        };
        this.childTools.push(tool);
        this.rebuild();
    }
    combinedScore(tool, terms, maxHits) {
        const relevance = this.scoreAgainstTerms(tool, terms);
        if (relevance <= 0)
            return 0;
        const normalizedHits = (this.hits.get(tool.name) ?? 0) / maxHits;
        return normalizedHits * 0.6 + relevance * 0.4;
    }
    scoreAgainstTerms(tool, queryTerms) {
        let score = 0;
        for (const term of queryTerms) {
            if (tool.nameTokens.has(term)) {
                score += 2.0;
            }
            else if ([...tool.descTokens].some((dt) => dt.includes(term))) {
                score += 1.0;
            }
        }
        return queryTerms.size > 0 ? score / (queryTerms.size * 2.0) : 0;
    }
    applyDecay(triggerTool) {
        const chain = this.chains.get(triggerTool);
        const groupNames = chain
            ? new Set([...chain.entries.map((e) => e.toolName ?? chain.toolName), ...chain.similarNames])
            : new Set([triggerTool]);
        for (const name of groupNames) {
            if (this.hits.has(name)) {
                this.hits.set(name, Math.max(-2000, (this.hits.get(name) ?? 0) - 500));
            }
        }
    }
    rebuild() {
        const map = new Map();
        for (const t of this.childTools)
            map.set(t.name, t);
        for (const t of this.nativeTools)
            map.set(t.name, t);
        this.merged = [...map.values()];
        const grouper = new grouper_js_1.SemanticGrouper(this.similarityThreshold);
        this.chains = grouper.buildChains(this.childTools);
    }
}
exports.UnifiedRegistry = UnifiedRegistry;
//# sourceMappingURL=registry.js.map