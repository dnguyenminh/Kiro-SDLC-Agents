"use strict";
/**
 * CoreMemoryManager — manages pinned entries for auto-recall.
 * Pinned entries are injected into agent context on every search.
 * Enforces a 2000-token budget across all pinned entries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreMemoryManager = void 0;
const token_counter_js_1 = require("./token-counter.js");
const DEFAULT_CONFIG = {
    maxTokens: 2000,
    warningThreshold: 1800,
    maxPinnedEntries: 10,
};
class CoreMemoryManager {
    db;
    config;
    constructor(db, config) {
        this.db = db;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /** Pin an entry. Returns success/failure message. */
    pin(entryId) {
        const entry = this.getEntry(entryId);
        if (!entry)
            return `Error: entry ${entryId} not found`;
        if (entry.pinned)
            return `Entry ${entryId} is already pinned`;
        if (this.getPinnedCount() >= this.config.maxPinnedEntries) {
            return `Error: max pinned entries (${this.config.maxPinnedEntries}) reached`;
        }
        const budget = this.getRemainingBudget();
        const tokens = (0, token_counter_js_1.countTokens)(entry.summary || entry.content);
        if (tokens > budget) {
            return `Error: entry needs ~${tokens} tokens but only ${budget} remaining in budget`;
        }
        const nextOrder = this.getNextPinOrder();
        this.db.prepare("UPDATE knowledge_entries SET pinned = 1, pin_order = ?, updated_at = datetime('now') WHERE id = ?").run(nextOrder, entryId);
        return `Pinned entry ${entryId} (order: ${nextOrder}, ~${tokens} tokens)`;
    }
    /** Unpin an entry. */
    unpin(entryId) {
        const entry = this.getEntry(entryId);
        if (!entry)
            return `Error: entry ${entryId} not found`;
        if (!entry.pinned)
            return `Entry ${entryId} is not pinned`;
        this.db.prepare("UPDATE knowledge_entries SET pinned = 0, pin_order = 0, updated_at = datetime('now') WHERE id = ?").run(entryId);
        return `Unpinned entry ${entryId}`;
    }
    /** List all pinned entries with token usage. */
    listPinned() {
        const rows = this.db.prepare('SELECT id, summary, content, pin_order FROM knowledge_entries WHERE pinned = 1 ORDER BY pin_order ASC').all();
        return rows.map(r => ({
            id: r.id,
            summary: r.summary || r.content.slice(0, 120),
            tokens: (0, token_counter_js_1.countTokens)(r.summary || r.content),
            pin_order: r.pin_order,
        }));
    }
    /** Reorder a pinned entry to a new position. */
    reorder(entryId, newOrder) {
        const entry = this.getEntry(entryId);
        if (!entry)
            return `Error: entry ${entryId} not found`;
        if (!entry.pinned)
            return `Error: entry ${entryId} is not pinned`;
        this.db.prepare("UPDATE knowledge_entries SET pin_order = ?, updated_at = datetime('now') WHERE id = ?").run(newOrder, entryId);
        return `Reordered entry ${entryId} to position ${newOrder}`;
    }
    /** Get pinned context string for injection into search results. */
    getContext() {
        const pinned = this.listPinned();
        if (pinned.length === 0)
            return '';
        const parts = ['--- PINNED CONTEXT ---'];
        let usedTokens = (0, token_counter_js_1.countTokens)(parts[0]);
        for (const p of pinned) {
            const line = `[#${p.id}] ${p.summary}`;
            const lineTokens = (0, token_counter_js_1.countTokens)(line);
            if (usedTokens + lineTokens > this.config.maxTokens) {
                const remaining = this.config.maxTokens - usedTokens;
                parts.push((0, token_counter_js_1.truncateToFit)(line, remaining));
                break;
            }
            parts.push(line);
            usedTokens += lineTokens;
        }
        parts.push('--- END PINNED ---');
        return parts.join('\n');
    }
    /** Get token budget status. */
    getBudgetStatus() {
        const used = this.getUsedTokens();
        const remaining = this.config.maxTokens - used;
        return {
            used,
            remaining,
            max: this.config.maxTokens,
            warning: used >= this.config.warningThreshold,
        };
    }
    getEntry(id) {
        return this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?')
            .get(id);
    }
    getPinnedCount() {
        const row = this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge_entries WHERE pinned = 1').get();
        return row.cnt;
    }
    getNextPinOrder() {
        const row = this.db.prepare('SELECT MAX(pin_order) as mx FROM knowledge_entries WHERE pinned = 1').get();
        return (row.mx ?? 0) + 1;
    }
    getUsedTokens() {
        const rows = this.db.prepare('SELECT summary, content FROM knowledge_entries WHERE pinned = 1').all();
        return rows.reduce((sum, r) => sum + (0, token_counter_js_1.countTokens)(r.summary || r.content), 0);
    }
    getRemainingBudget() {
        return this.config.maxTokens - this.getUsedTokens();
    }
}
exports.CoreMemoryManager = CoreMemoryManager;
//# sourceMappingURL=core-memory.js.map