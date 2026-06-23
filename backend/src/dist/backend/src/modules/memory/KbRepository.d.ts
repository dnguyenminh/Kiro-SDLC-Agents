/**
 * KbRepository — CRUD operations for multi-tier kb_entries table.
 * Implements TDD §4.2 kb_entries, §4.4 Key Query Patterns.
 */
import { IDatabase } from '../auth/UserRepository';
import { KbEntry } from './types';
export declare class KbRepository {
    private readonly db;
    constructor(db: IDatabase);
    create(entry: {
        title?: string;
        content: string;
        tier: 1 | 2 | 3;
        owner_id: string;
        project_id?: string;
        tags?: string[];
        quality_score?: number;
        ttl_days?: number;
        promoted_from?: string;
        promoted_by?: string;
    }): KbEntry;
    findById(id: string): KbEntry | null;
    findUserEntries(userId: string, limit?: number): KbEntry[];
    findProjectEntries(projectIds: string[], limit?: number): KbEntry[];
    findSharedEntries(limit?: number): KbEntry[];
    findPromotionCandidates(tier: 1 | 2, qualityThreshold?: number): KbEntry[];
    markPromoted(entryId: string): void;
    deleteExpiredEntries(): number;
    countUserEntries(userId: string): number;
    countProjectEntries(projectId: string): number;
    countSharedEntries(): number;
    findByContentHash(hash: string): KbEntry[];
}
//# sourceMappingURL=KbRepository.d.ts.map