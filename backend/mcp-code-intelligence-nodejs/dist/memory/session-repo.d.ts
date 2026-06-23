/**
 * SessionRepository — tracks MCP sessions (one per connection).
 */
import Database from 'better-sqlite3';
import { MemorySession } from './models.js';
export declare class SessionRepository {
    private readonly db;
    constructor(db: Database.Database);
    /** Start a new session, returns session ID (8-char UUID prefix). */
    startSession(agentName?: string): string;
    /** End a session. */
    endSession(sessionId: string): void;
    /** Increment observation count. */
    incrementObservations(sessionId: string): void;
    /** List recent sessions. */
    listRecent(limit?: number): MemorySession[];
    /** List sessions with optional agent and status filters. */
    listFiltered(agent: string, status: string, limit: number): MemorySession[];
    /** Get active session count. */
    activeCount(): number;
}
//# sourceMappingURL=session-repo.d.ts.map