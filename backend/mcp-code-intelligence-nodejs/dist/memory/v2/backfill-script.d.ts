/**
 * Backfill script — processes existing entries to populate structured_map
 * and entity_index. Non-destructive and idempotent.
 */
import Database from 'better-sqlite3';
/** Backfill all entries missing structured maps. Returns count processed. */
export declare function backfillStructuredMaps(db: Database.Database): number;
//# sourceMappingURL=backfill-script.d.ts.map