"use strict";
/**
 * AgentScopeFilter — tag-based KB isolation per agent role.
 * Each agent role has a configurable tag set. Search results are
 * filtered to only include entries matching the agent's tags.
 * Untagged entries remain visible to all agents (backward compatible).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentScopeFilter = void 0;
class AgentScopeFilter {
    db;
    cache = new Map();
    constructor(db) {
        this.db = db;
        this.loadCache();
    }
    /** Get scope configuration for an agent role. */
    getScope(agentRole) {
        const tags = this.cache.get(agentRole.toUpperCase());
        if (!tags)
            return null;
        return { role: agentRole.toUpperCase(), tags };
    }
    /** Filter search results by agent's tag set. */
    filter(results, agentRole) {
        const scope = this.getScope(agentRole);
        if (!scope)
            return results; // Unknown role → no filtering
        return results.filter(r => {
            const entryTags = parseTags(r.entry.tags);
            // Untagged entries visible to all (BR-F4-02)
            if (entryTags.length === 0)
                return true;
            // Entry must have at least one matching tag
            return entryTags.some(t => scope.tags.includes(t));
        });
    }
    /** Update scope configuration for a role. */
    updateScope(agentRole, tags) {
        const role = agentRole.toUpperCase();
        const tagJson = JSON.stringify(tags);
        this.db.prepare(`
      INSERT INTO agent_scope_config (agent_role, tag_set, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(agent_role) DO UPDATE SET
        tag_set = excluded.tag_set,
        updated_at = datetime('now')
    `).run(role, tagJson);
        this.cache.set(role, tags);
    }
    /** Reload cache from database. */
    loadCache() {
        this.cache.clear();
        try {
            const rows = this.db.prepare('SELECT agent_role, tag_set FROM agent_scope_config').all();
            for (const row of rows) {
                const tags = JSON.parse(row.tag_set);
                this.cache.set(row.agent_role, tags);
            }
        }
        catch {
            // Table may not exist yet (pre-migration)
        }
    }
}
exports.AgentScopeFilter = AgentScopeFilter;
/** Parse comma-separated tags string into array. */
function parseTags(tags) {
    if (!tags)
        return [];
    return tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
}
//# sourceMappingURL=agent-scope-filter.js.map