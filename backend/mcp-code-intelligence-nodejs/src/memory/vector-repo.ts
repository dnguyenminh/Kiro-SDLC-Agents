/**
 * VectorRepository — CRUD for knowledge entry embeddings.
 */

import Database from 'better-sqlite3';

export interface VectorRecord {
  id: number;
  entry_id: number;
  vector: Buffer;
  model: string;
  dimensions: number;
  created_at: string;
}

export class VectorRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Store or update embedding vector for an entry. */
  upsert(entryId: number, vector: Buffer, model: string, dimensions: number): void {
    this.db.prepare(`
      INSERT INTO knowledge_vectors (entry_id, vector, model, dimensions)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(entry_id) DO UPDATE SET
        vector = excluded.vector,
        model = excluded.model,
        dimensions = excluded.dimensions,
        created_at = datetime('now')
    `).run(entryId, vector, model, dimensions);
  }

  /** Get all vectors (for brute-force similarity). */
  findAll(): VectorRecord[] {
    return this.db.prepare('SELECT * FROM knowledge_vectors').all() as VectorRecord[];
  }

  /** Get vector for a specific entry (as float32 array). KSA-190. */
  getVector(entryId: number): number[] | null {
    const row = this.db.prepare(
      'SELECT vector, dimensions FROM knowledge_vectors WHERE entry_id = ?'
    ).get(entryId) as { vector: Buffer; dimensions: number } | undefined;
    if (!row) return null;
    const floats: number[] = [];
    for (let i = 0; i < row.vector.length; i += 4) {
      floats.push(row.vector.readFloatLE(i));
    }
    return floats;
  }

  /** Count total vectors stored. */
  count(): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM knowledge_vectors'
    ).get() as { cnt: number };
    return row.cnt;
  }
}
