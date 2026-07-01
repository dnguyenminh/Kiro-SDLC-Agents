import { AuditEntry, PaginatedResult, PaginationParams } from '../types/admin.types.js';
export declare class AuditService {
    private db;
    constructor(db: any);
    record(entry: Omit<AuditEntry, 'auditId' | 'timestamp'>): void;
    list(filters: {
        userId?: string;
        action?: string;
        dateFrom?: string;
        dateTo?: string;
    }, pagination: PaginationParams): PaginatedResult<AuditEntry>;
    export(format: 'csv' | 'json', dateFrom: string, dateTo: string): string;
}
