/**
 * KSA-168: Duplicate Detector — Find near-duplicate code using embedding similarity.
 * Uses cosine similarity on body embeddings + Union-Find clustering.
 */
import Database from 'better-sqlite3';
import type { DuplicateReport } from './types.js';
export declare class DuplicateDetector {
    private db;
    private minSimilarity;
    private minLines;
    constructor(db: Database.Database, minSimilarity?: number, minLines?: number);
    /** Find duplicate functions in the codebase. */
    detect(options?: {
        filePath?: string;
        module?: string;
        limit?: number;
    }): DuplicateReport;
    private loadEmbeddings;
    private computeSimilarities;
    private buildClusters;
    private generateSuggestion;
}
