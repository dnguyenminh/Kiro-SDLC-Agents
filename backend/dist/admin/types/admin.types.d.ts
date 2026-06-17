/**
 * Admin portal shared types — pagination, filters, service interfaces.
 * Implements: TDD §5.2 Service Interfaces
 */
import type { User, UserStatus, AccessGroup, GroupPermission, AuditEntry, PermissionId } from './rbac.types.js';
export interface PaginationParams {
    page: number;
    pageSize: number;
}
export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
export interface UserFilters {
    status?: UserStatus;
    accessGroupId?: string;
    search?: string;
}
export interface AuditFilters {
    userId?: string;
    action?: string;
    resource?: string;
    dateFrom?: string;
    dateTo?: string;
}
export interface DateRange {
    from: string;
    to: string;
}
export interface CreateUserRequest {
    username: string;
    email: string;
    password: string;
    accessGroupId: string;
}
export interface UpdateStatusRequest {
    status: 'ACTIVE' | 'DISABLED';
}
export interface CreateGroupRequest {
    accessGroupName: string;
    permissions: Array<{
        permissionId: string;
        roleData: Record<string, unknown>;
    }>;
}
export interface UpdateGroupRequest {
    accessGroupName?: string;
    permissions: Array<{
        permissionId: string;
        roleData: Record<string, unknown>;
    }>;
}
export interface IUserService {
    listUsers(filters: UserFilters, pagination: PaginationParams): PaginatedResult<User>;
    createUser(data: CreateUserRequest): User;
    getUserById(userId: string): User | null;
    updateStatus(userId: string, status: 'ACTIVE' | 'DISABLED'): {
        sessionsTerminated: number;
    };
    deleteUser(userId: string): void;
    forceLogout(userId: string, sessionId?: string): {
        terminated: number;
    };
    resetPassword(userId: string): {
        temporaryPassword: string;
    };
}
export interface IRBACService {
    checkPermission(userId: string, required: PermissionId, context?: Record<string, unknown>): boolean;
    getUserPermissions(userId: string): GroupPermission[];
    getGroups(): AccessGroup[];
    getGroupById(groupId: string): AccessGroup | null;
    createGroup(data: CreateGroupRequest): AccessGroup;
    updateGroup(groupId: string, data: UpdateGroupRequest): AccessGroup;
    deleteGroup(groupId: string): void;
    invalidateCache(userId?: string): void;
}
export interface IAuditService {
    record(entry: Omit<AuditEntry, 'auditId' | 'timestamp'>): void;
    list(filters: AuditFilters, pagination: PaginationParams): PaginatedResult<AuditEntry>;
    export(format: 'csv' | 'json', dateRange: DateRange): string;
}
export interface AdminAuthContext {
    userId: string;
    username: string;
    accessGroupId: string;
    permissions: GroupPermission[];
}
