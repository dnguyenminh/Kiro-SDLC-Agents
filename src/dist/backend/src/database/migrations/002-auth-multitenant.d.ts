/**
 * Migration 002 — Auth, Multi-Tenant KB, and MCP Config tables.
 * Implements TDD §4.2 DDL Scripts, §4.3 Migration Strategy.
 */
import { IDatabase } from '../../modules/auth/UserRepository';
export declare const MIGRATION_002: {
    version: number;
    name: string;
    up: (db: IDatabase) => void;
    down: (db: IDatabase) => void;
};
//# sourceMappingURL=002-auth-multitenant.d.ts.map