/**
 * KSA-163: Dead Import Detector — Finds unused imports.
 */
import Database from 'better-sqlite3';
import type { DeadImport } from './types.js';
export declare class DeadImportDetector {
    private db;
    constructor(db: Database.Database);
    /** Find dead (unused) imports in a file or across the project. */
    detect(options?: {
        filePath?: string;
        module?: string;
        limit?: number;
    }): DeadImport[];
}
