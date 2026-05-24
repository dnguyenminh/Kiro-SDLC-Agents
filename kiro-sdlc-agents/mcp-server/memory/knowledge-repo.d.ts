/**
 * KnowledgeRepository — CRUD operations for knowledge entries.
 */
import Database from 'better-sqlite3';
import { KnowledgeEntry } from './models.js';
export declare class KnowledgeRepository {
    private readonly db;
    constructor(db: Database.Database);
    /** Insert a new knowledge entry, returns generated ID. */
    insert(entry: Partial<KnowledgeEntry>): number;
    /** Find entry by ID. */
    findById(id: number): KnowledgeEntry | undefined;
    /** Find entries by tier. */
    findByTier(tier: string, limit?: number): KnowledgeEntry[];
    /** Find entries by type. */
    findByType(type: string, limit?: number): KnowledgeEntry[];
    /** Find entries with flexible filters, sorting, and pagination. */
    findFiltered(tier?: string, type?: string, limit?: number, offset?: number, sort?: string, afterId?: number): KnowledgeEntry[];
    /** Update tier for an entry. */
    updateTier(id: number, newTier: string): void;
    /** Increment access count and update last_accessed_at. */
    recordAccess(id: number): void;
    /** Delete entry by ID. */
    delete(id: number): void;
    /** Update structured_map JSON for an entry. */
    updateStructuredMap(id: number, mapJson: string): void;
    /** Update quality_score for an entry. */
    updateQualityScore(id: number, score: number): void;
    /** Get structured_map for an entry. */
    getStructuredMap(id: number): string;
}
//# sourceMappingURL=knowledge-repo.d.ts.map