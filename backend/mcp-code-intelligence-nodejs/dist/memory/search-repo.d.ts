/**
 * KnowledgeSearchRepository — FTS5 full-text search for knowledge entries.
 */
import Database from 'better-sqlite3';
import { SearchResult } from './models.js';
export declare class KnowledgeSearchRepository {
    private readonly db;
    constructor(db: Database.Database);
    /** Full-text search using FTS5. */
    search(query: string, limit?: number): SearchResult[];
    /** Search within a specific tier. */
    searchInTier(query: string, tier: string, limit?: number): SearchResult[];
    private sanitizeQuery;
    private stripRank;
}
//# sourceMappingURL=search-repo.d.ts.map