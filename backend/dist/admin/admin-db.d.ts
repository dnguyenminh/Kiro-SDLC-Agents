/**
 * Admin Portal SQLite Database Layer
 * Persistent storage for users, RBAC groups, sessions, and audit trail.
 * Uses better-sqlite3 for synchronous, fast SQLite access.
 */
import Database from 'better-sqlite3';
import type { User, UserStatus, AccessGroup, GroupPermission, Session, AuditEntry } from './types/rbac.types.js';
export declare function getAdminDb(): Database.Database;
export declare function hashPassword(password: string): string;
export declare function verifyPassword(password: string, stored: string): boolean;
export declare function generateToken(): string;
export declare function createSession(userId: string, device?: string, ip?: string): Session & {
    token: string;
};
export declare function validateSession(token: string): {
    userId: string;
    username: string;
    accessGroupId: string;
} | null;
export declare function invalidateSession(token: string): void;
export declare function invalidateUserSessions(userId: string): number;
export declare function getUsers(filters?: {
    status?: string;
    search?: string;
    accessGroupId?: string;
}, page?: number, pageSize?: number): {
    items: any[];
    total: number;
};
export declare function getUserById(userId: string): User | null;
export declare function getUserByUsername(username: string): (User & {
    passwordHash: string;
}) | null;
export declare function createUser(username: string, email: string, password: string, accessGroupId: string): User;
export declare function updateUserStatus(userId: string, status: UserStatus): number;
export declare function deleteUser(userId: string): void;
export declare function resetUserPassword(userId: string): string;
export declare function changePassword(userId: string, newPassword: string): void;
export declare function updateLastLogin(userId: string): void;
export declare function getGroups(): AccessGroup[];
export declare function getGroupById(groupId: string): AccessGroup | null;
export declare function createGroup(name: string, permissions: GroupPermission[]): AccessGroup;
export declare function updateGroup(groupId: string, name: string | undefined, permissions: GroupPermission[]): AccessGroup;
export declare function deleteGroup(groupId: string): void;
export declare function getUserPermissions(userId: string): GroupPermission[];
export declare function recordAudit(userId: string, username: string, action: string, resource: string, resourceId?: string, changes?: string, ip?: string): void;
export declare function getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
}, page?: number, pageSize?: number): {
    items: AuditEntry[];
    total: number;
};
export declare function getUserSessions(userId: string): Session[];
export interface ConfigChange {
    id: number;
    section: string;
    key: string;
    oldValue: string | null;
    newValue: string;
    changedBy: string;
    changedAt: string;
    requiresRestart: boolean;
}
export declare function recordConfigChange(section: string, key: string, oldValue: string | null, newValue: string, changedBy: string, requiresRestart: boolean): void;
export declare function getConfigChanges(limit?: number): ConfigChange[];
export declare function initQueryLogsTable(): void;
export declare function recordQueryLog(query: string, responseTimeMs: number, resultCount: number, userId?: string): void;
export declare function getQueryLogs(days?: number, userId?: string): {
    date: string;
    queries: number;
    avgResponseTime: number;
}[];
export declare function getQueryLogStats(userId?: string): {
    totalQueries: number;
    avgResponseTime: number;
    queriesLast24h: number;
};
export declare function initPromotionCooldownTable(): void;
export declare function setPromotionCooldown(entryId: string, rejectedBy: string): void;
export declare function checkPromotionCooldown(entryId: string): {
    onCooldown: boolean;
    cooldownUntil?: string;
};
export declare function searchKbEntries(query: string): {
    items: any[];
    total: number;
};
export declare function getKbEmbeddings(limit?: number): {
    items: {
        id: string;
        label: string;
        x: number;
        y: number;
        type: string;
    }[];
    hasRealData: boolean;
};
export declare function getKbEntryById(entryId: string): any | null;
export declare function getKbEntryCount(): number;
export declare function getKbEntries(page?: number, pageSize?: number, sortBy?: string, sortDir?: 'asc' | 'desc'): {
    items: any[];
    total: number;
};
export declare function getRecentActivity(limit?: number): AuditEntry[];
export declare function getAllKbTags(): Record<string, {
    count: number;
    lastUsed: string;
}>;
export declare function updateKbEntryTags(entryId: string, tags: string[]): void;
export declare function renameKbTag(oldName: string, newName: string): number;
export declare function deleteKbTag(tagName: string): number;
export declare function mergeKbTags(sourceTag: string, targetTag: string): number;
export declare function getKbEntriesByTag(tagName: string): any[];
