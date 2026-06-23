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

export class EntityRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Index entities for an entry (replaces existing). */
  indexEntities(entryId: number, entities: Array<{ name: string; type: string }>): void {
    this.db.prepare('DELETE FROM entity_index WHERE entry_id = ?').run(entryId);
    const stmt = this.db.prepare(
      'INSERT INTO entity_index (entry_id, entity_name, entity_type) VALUES (?, ?, ?)'
    );
    for (const e of entities) {
      stmt.run(entryId, e.name, e.type);
    }
  }

  /** Find entry IDs that mention a specific entity. */
  findByEntity(entityName: string, limit = 20): number[] {
    const rows = this.db.prepare(
      'SELECT DISTINCT entry_id FROM entity_index WHERE entity_name LIKE ? LIMIT ?'
    ).all(`%${entityName}%`, limit) as Array<{ entry_id: number }>;
    return rows.map(r => r.entry_id);
  }

  /** Find entry IDs by entity type. */
  findByType(entityType: string, limit = 20): number[] {
    const rows = this.db.prepare(
      'SELECT DISTINCT entry_id FROM entity_index WHERE entity_type = ? LIMIT ?'
    ).all(entityType, limit) as Array<{ entry_id: number }>;
    return rows.map(r => r.entry_id);
  }

  /** Get all entities for an entry. */
  getEntities(entryId: number): EntityRecord[] {
    return this.db.prepare(
      'SELECT * FROM entity_index WHERE entry_id = ?'
    ).all(entryId) as EntityRecord[];
  }

  /** Search entities by name pattern. */
  searchEntities(pattern: string, limit = 20): EntityRecord[] {
    return this.db.prepare(
      'SELECT * FROM entity_index WHERE entity_name LIKE ? LIMIT ?'
    ).all(`%${pattern}%`, limit) as EntityRecord[];
  }
}
