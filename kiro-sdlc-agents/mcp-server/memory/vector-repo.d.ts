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
export declare class VectorRepository {
    private readonly db;
    constructor(db: Database.Database);
    /** Store or update embedding vector for an entry. */
    upsert(entryId: number, vector: Buffer, model: string, dimensions: number): void;
    /** Get all vectors (for brute-force similarity). */
    findAll(): VectorRecord[];
    /** Count total vectors stored. */
    count(): number;
}
//# sourceMappingURL=vector-repo.d.ts.map