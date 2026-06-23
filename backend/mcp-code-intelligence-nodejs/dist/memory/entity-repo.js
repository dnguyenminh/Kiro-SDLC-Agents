"use strict";
/**
 * EntityRepository — CRUD for entity_index table.
 * Supports searching entries by entity name or type.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityRepository = void 0;
class EntityRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Index entities for an entry (replaces existing). */
    indexEntities(entryId, entities) {
        this.db.prepare('DELETE FROM entity_index WHERE entry_id = ?').run(entryId);
        const stmt = this.db.prepare('INSERT INTO entity_index (entry_id, entity_name, entity_type) VALUES (?, ?, ?)');
        for (const e of entities) {
            stmt.run(entryId, e.name, e.type);
        }
    }
    /** Find entry IDs that mention a specific entity. */
    findByEntity(entityName, limit = 20) {
        const rows = this.db.prepare('SELECT DISTINCT entry_id FROM entity_index WHERE entity_name LIKE ? LIMIT ?').all(`%${entityName}%`, limit);
        return rows.map(r => r.entry_id);
    }
    /** Find entry IDs by entity type. */
    findByType(entityType, limit = 20) {
        const rows = this.db.prepare('SELECT DISTINCT entry_id FROM entity_index WHERE entity_type = ? LIMIT ?').all(entityType, limit);
        return rows.map(r => r.entry_id);
    }
    /** Get all entities for an entry. */
    getEntities(entryId) {
        return this.db.prepare('SELECT * FROM entity_index WHERE entry_id = ?').all(entryId);
    }
    /** Search entities by name pattern. */
    searchEntities(pattern, limit = 20) {
        return this.db.prepare('SELECT * FROM entity_index WHERE entity_name LIKE ? LIMIT ?').all(`%${pattern}%`, limit);
    }
}
exports.EntityRepository = EntityRepository;
//# sourceMappingURL=entity-repo.js.map