/**
 * KSA-163: Module Summarizer — Aggregates quality metrics per module.
 */
import Database from 'better-sqlite3';
import type { ModuleSummary } from './types.js';
export declare class ModuleSummarizer {
    private db;
    private graphLoader;
    constructor(db: Database.Database);
    /** Generate summary for a specific module or all modules. */
    summarize(moduleName?: string): ModuleSummary[];
    private getModules;
    private getAvgComplexity;
}
