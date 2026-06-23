/**
 * AgentScopeFilter — tag-based KB isolation per agent role.
 * Each agent role has a configurable tag set. Search results are
 * filtered to only include entries matching the agent's tags.
 * Untagged entries remain visible to all agents (backward compatible).
 */
import Database from 'better-sqlite3';
import { SearchResult } from '../models.js';
export interface AgentScope {
    role: string;
    tags: string[];
}
export declare class AgentScopeFilter {
    private readonly db;
    private cache;
    constructor(db: Database.Database);
    /** Get scope configuration for an agent role. */
    getScope(agentRole: string): AgentScope | null;
    /** Filter search results by agent's tag set. */
    filter(results: SearchResult[], agentRole: string): SearchResult[];
    /** Update scope configuration for a role. */
    updateScope(agentRole: string, tags: string[]): void;
    /** Reload cache from database. */
    private loadCache;
}
//# sourceMappingURL=agent-scope-filter.d.ts.map