/**
 * UserRepository — CRUD operations for the users table.
 * Implements TDD §4.2 users table, §4.4 Key Query Patterns.
 */
import { UserRecord } from './types';
export interface IDatabase {
    prepare(sql: string): IStatement;
    exec(sql: string): void;
}
export interface IStatement {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): {
        changes: number;
        lastInsertRowid: number | bigint;
    };
}
export declare class UserRepository {
    private readonly db;
    constructor(db: IDatabase);
    findByUsername(username: string): UserRecord | null;
    findByEmail(email: string): UserRecord | null;
    findById(id: string): UserRecord | null;
    findBySsoSubject(provider: string, subject: string): UserRecord | null;
    create(user: {
        id: string;
        username: string;
        email: string;
        display_name?: string;
        password_hash?: string;
        role?: 'user' | 'admin';
        sso_provider?: string;
        sso_subject?: string;
        projects?: string[];
    }): UserRecord;
    incrementFailedAttempts(userId: string): void;
    lockAccount(userId: string, lockUntil: Date): void;
    resetFailedAttempts(userId: string): void;
    updateProjects(userId: string, projects: string[]): void;
}
//# sourceMappingURL=UserRepository.d.ts.map