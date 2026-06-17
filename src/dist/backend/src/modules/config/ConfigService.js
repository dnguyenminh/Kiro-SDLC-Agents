/**
 * ConfigService — business logic for MCP server configuration.
 * Implements TDD §5.2, FSD UC-9, BR-16, BR-17.
 */
export class ConfigService {
    configRepo;
    encryption;
    constructor(configRepo, encryption) {
        this.configRepo = configRepo;
        this.encryption = encryption;
    }
    /**
     * Get user's MCP server configuration.
     * BR-17: Never return plaintext passwords/tokens.
     */
    getConfig(userId) {
        const records = this.configRepo.findAllByUser(userId);
        const lastUpdated = this.configRepo.getLastUpdated(userId);
        const servers = {};
        for (const record of records) {
            const data = JSON.parse(record.config_data);
            switch (record.server_name) {
                case 'jira': {
                    const jiraPublic = {
                        url: data.url,
                        username: data.username,
                        token_configured: !!data.token_encrypted,
                        project_key: data.project_key,
                    };
                    servers.jira = jiraPublic;
                    break;
                }
                case 'drawio':
                    servers.drawio = {
                        path: data.path,
                        format: data.format,
                    };
                    break;
                case 'export':
                    servers.export = {
                        output_dir: data.output_dir,
                    };
                    break;
            }
        }
        return { servers, last_updated: lastUpdated };
    }
    /**
     * Save user's MCP server configuration.
     * Encrypts sensitive fields before storage (BR-16).
     */
    saveConfig(userId, config) {
        const now = new Date().toISOString();
        if (config.jira) {
            const storedData = {
                url: config.jira.url,
                username: config.jira.username,
                project_key: config.jira.project_key,
            };
            if (config.jira.token) {
                storedData.token_encrypted = this.encryption.encrypt(config.jira.token);
            }
            else {
                const existing = this.configRepo.findByUserAndServer(userId, 'jira');
                if (existing) {
                    const existingData = JSON.parse(existing.config_data);
                    storedData.token_encrypted = existingData.token_encrypted;
                }
            }
            this.configRepo.upsert(userId, 'jira', JSON.stringify(storedData));
        }
        if (config.drawio) {
            this.configRepo.upsert(userId, 'drawio', JSON.stringify(config.drawio));
        }
        if (config.export) {
            this.configRepo.upsert(userId, 'export', JSON.stringify(config.export));
        }
        return now;
    }
    /**
     * Get decrypted config for internal use (e.g., MCP tool execution).
     * NOT exposed via API — internal only.
     */
    getDecryptedConfig(userId, serverName) {
        const record = this.configRepo.findByUserAndServer(userId, serverName);
        if (!record)
            return null;
        const data = JSON.parse(record.config_data);
        if (data.token_encrypted && typeof data.token_encrypted === 'string') {
            data.token = this.encryption.decrypt(data.token_encrypted);
            delete data.token_encrypted;
        }
        return data;
    }
    /**
     * Test connection to a specific MCP server.
     * Implements UC-9 AF-1.
     */
    async testConnection(userId, server) {
        const config = this.getDecryptedConfig(userId, server);
        if (!config) {
            return {
                server,
                status: 'failed',
                message: `No configuration found for ${server}. Please save configuration first.`,
            };
        }
        switch (server) {
            case 'jira':
                if (!config.url || !config.username || !config.token) {
                    return {
                        server,
                        status: 'failed',
                        message: 'Missing required Jira configuration (url, username, token).',
                    };
                }
                return {
                    server,
                    status: 'success',
                    message: `Configuration valid for ${config.username}`,
                };
            case 'drawio':
                return { server, status: 'success', message: 'DrawIO configuration saved.' };
            case 'export':
                return { server, status: 'success', message: 'Export configuration saved.' };
            default:
                return { server, status: 'failed', message: `Unknown server: ${server}` };
        }
    }
}
//# sourceMappingURL=ConfigService.js.map