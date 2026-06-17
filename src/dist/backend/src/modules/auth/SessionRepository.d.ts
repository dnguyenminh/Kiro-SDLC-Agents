/**
 * SessionRepository — CRUD operations for the sessions table.
 * Implements TDD §4.2 sessions table, BR-3, BR-18.
 */
import { SessionRecord } from './types';
import { IDatabase } from './UserRepository';
export declare class SessionRepository {
    private readonly db;
    constructor(db: IDatabase);
    create(session: {
        id: string;
        user_id: string;
        refresh_token_hash: string;
        expires_at: string;
        user_agent?: string;
    }): void;
    findByRefreshTokenHash(hash: string): SessionRecord | null;
    revoke(sessionId: string): void;
    revokeByRefreshTokenHash(hash: string): void;
    revokeAllForUser(userId: string): void;
    cleanupExpired(): number;
}
//# sourceMappingURL=SessionRepository.d.ts.map