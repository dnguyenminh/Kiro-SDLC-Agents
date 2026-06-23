/**
 * ConversationRepository — CRUD for structured conversation turns.
 * Stores conversations as structured JSON (role, content, turn, session).
 */
import Database from 'better-sqlite3';
export interface ConversationTurn {
    id: number;
    session_id: string;
    turn_number: number;
    role: string;
    content: string;
    tool_calls: string | null;
    metadata: string | null;
    created_at: string;
}
export interface SessionSummary {
    session_id: string;
    turn_count: number;
    first_turn_at: string;
    last_turn_at: string;
    roles: string[];
}
export declare class ConversationRepository {
    private readonly db;
    constructor(db: Database.Database);
    /** Save a conversation turn. Returns turn ID. */
    saveTurn(sessionId: string, role: string, content: string, toolCalls?: object[], metadata?: object): number;
    /** Get all turns for a session, ordered by turn number. */
    getSession(sessionId: string, limit?: number): ConversationTurn[];
    /** List sessions with conversation data. */
    listSessions(limit?: number): SessionSummary[];
    /** Search turns by content. */
    searchTurns(query: string, limit?: number): ConversationTurn[];
    /** Get turns by time range. */
    getTurnsByTimeRange(after: string, before?: string, limit?: number): ConversationTurn[];
    /** Get turn count for a session. */
    getSessionTurnCount(sessionId: string): number;
    private getNextTurnNumber;
    private getSessionRoles;
}
//# sourceMappingURL=conversation-repo.d.ts.map