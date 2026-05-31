/**
 * KSA-168: Git Miner — Semantic search over git commit history.
 * Parses git log, stores commit metadata, enables text-based search.
 */
import Database from 'better-sqlite3';
import type { GitCommitResult, GitIndexSummary } from './types.js';
export declare class GitMiner {
    private db;
    private repoPath;
    private maxCommits;
    constructor(db: Database.Database, repoPath: string, maxCommits?: number);
    /** Index git commits (incremental by default). */
    indexHistory(force?: boolean): GitIndexSummary;
    /** Search commits by text query (FTS on message + files). */
    search(query: string, options?: {
        author?: string;
        file?: string;
        limit?: number;
        since?: string;
    }): GitCommitResult[];
    /** Get indexing summary. */
    getSummary(): GitIndexSummary;
    private parseGitLog;
    private parseLogOutput;
    private getLastIndexedHash;
    private ensureSchema;
}
//# sourceMappingURL=GitMiner.d.ts.map