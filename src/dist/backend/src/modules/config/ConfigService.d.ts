/**
 * ConfigService — business logic for MCP server configuration.
 * Implements TDD §5.2, FSD UC-9, BR-16, BR-17.
 */
import { ConfigRepository } from './ConfigRepository';
import { EncryptionService } from './EncryptionService';
import { McpServerConfig, McpConfigResponse, TestConnectionResponse } from './types';
export declare class ConfigService {
    private readonly configRepo;
    private readonly encryption;
    constructor(configRepo: ConfigRepository, encryption: EncryptionService);
    /**
     * Get user's MCP server configuration.
     * BR-17: Never return plaintext passwords/tokens.
     */
    getConfig(userId: string): McpConfigResponse;
    /**
     * Save user's MCP server configuration.
     * Encrypts sensitive fields before storage (BR-16).
     */
    saveConfig(userId: string, config: McpServerConfig): string;
    /**
     * Get decrypted config for internal use (e.g., MCP tool execution).
     * NOT exposed via API — internal only.
     */
    getDecryptedConfig(userId: string, serverName: string): Record<string, unknown> | null;
    /**
     * Test connection to a specific MCP server.
     * Implements UC-9 AF-1.
     */
    testConnection(userId: string, server: string): Promise<TestConnectionResponse>;
}
//# sourceMappingURL=ConfigService.d.ts.map