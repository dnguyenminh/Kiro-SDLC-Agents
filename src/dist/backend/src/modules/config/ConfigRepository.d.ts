/**
 * ConfigRepository — CRUD operations for mcp_config table.
 * Implements TDD §4.2 mcp_config table.
 */
import { IDatabase } from '../auth/UserRepository';
import { McpConfigRecord } from './types';
export declare class ConfigRepository {
    private readonly db;
    constructor(db: IDatabase);
    findByUserAndServer(userId: string, serverName: string): McpConfigRecord | null;
    findAllByUser(userId: string): McpConfigRecord[];
    upsert(userId: string, serverName: string, configData: string): void;
    delete(userId: string, serverName: string): void;
    getLastUpdated(userId: string): string | null;
}
//# sourceMappingURL=ConfigRepository.d.ts.map