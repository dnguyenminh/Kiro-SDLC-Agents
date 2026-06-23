/**
 * KSA-162: Entry Point Detector — Main orchestrator.
 */
import Database from 'better-sqlite3';
import type { EntryPoint, EntryPointFilters, EntryPointQueryResult } from './types.js';
export declare class EntryPointDetector {
    private registry;
    private frameworkDetector;
    private httpDetector;
    private mainDetector;
    private cliDetector;
    private eventDetector;
    private store;
    private db;
    constructor(db: Database.Database);
    /** Detect all entry points in a file. */
    detectFile(filePath: string, source: string, language: string, symbols: Array<{
        id: number;
        name: string;
        decorators?: string[];
        parentName?: string | null;
        filePath: string;
        startLine: number;
    }>): EntryPoint[];
    /** Query stored entry points. */
    query(filters: EntryPointFilters): EntryPointQueryResult;
}
