import { AdminUser, PaginatedResult, PaginationParams } from '../types/admin.types.js';
export declare class UserService {
    private db;
    constructor(db: any);
    list(filters: {
        status?: string;
        search?: string;
    }, pagination: PaginationParams): PaginatedResult<AdminUser>;
    create(data: {
        username: string;
        email: string;
        password: string;
        accessGroupId: string;
    }): Promise<AdminUser>;
    updateStatus(userId: string, status: 'ACTIVE' | 'DISABLED'): {
        sessionsTerminated: number;
    };
    delete(userId: string): void;
    forceLogout(userId: string, sessionId?: string): {
        terminated: number;
    };
    resetPassword(userId: string): Promise<{
        temporaryPassword: string;
    }>;
}
