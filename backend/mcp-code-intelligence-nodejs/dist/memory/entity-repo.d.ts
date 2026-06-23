/**
 * EntityRepository — CRUD for entity_index table.
 * Supports searching entries by entity name or type.
 */
import Database from 'better-sqlite3';
export interface EntityRecord {
    id: number;
    entry_id: number;
    entity_name: string;
    entity_type: string;
}
export declare class EntityRepository {
    private readonly db;
    constructor(db: Database.Database);
    /** Index entities for an entry (replaces existing). */
    indexEntities(entryId: number, entities: Array<{
        name: string;
        type: string;
    }>): void;
    /** Find entry IDs that mention a specific entity. */
    findByEntity(entityName: string, limit?: number): number[];
    /** Find entry IDs by entity type. */
    findByType(entityType: string, limit?: number): number[];
    /** Get all entities for an entry. */
    getEntities(entryId: number): EntityRecord[];
    /** Search entities by name pattern. */
    searchEntities(pattern: string, limit?: number): EntityRecord[];
}
//# sourceMappingURL=entity-repo.d.ts.map