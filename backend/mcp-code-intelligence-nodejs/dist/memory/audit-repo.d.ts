/**
 * AuditRepository — logs all memory operations for observability.
 */
import Database from 'better-sqlite3';
import { AuditEntry } from './models.js';
export declare class AuditRepository {
    private readonly db;
    constructor(db: Database.Database);
    /** Log an operation to the audit trail. */
    log(operation: string, entryId?: number, sessionId?: string, details?: string): void;
    /** List audit entries for a specific session. */
    listBySession(sessionId: string, limit?: number): AuditEntry[];
    /** List recent audit entries. */
    listRecent(limit?: number, operation?: string): AuditEntry[];
    /** List audit entries after a given ID (for streaming). */
    listRecentAfterId(afterId: number, limit?: number): AuditEntry[];
    /** List audit entries with exclude filter (for stream tab). */
    listFiltered(limit: number, afterId: number | null, exclude: string[]): AuditEntry[];
}
//# sourceMappingURL=audit-repo.d.ts.map