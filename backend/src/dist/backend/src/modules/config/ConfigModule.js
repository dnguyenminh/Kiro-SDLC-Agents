/**
 * ConfigModule — IModule implementation for MCP server configuration.
 * Implements TDD §5.2 modules/config/ConfigModule.ts.
 */
import { ConfigRepository } from './ConfigRepository';
import { ConfigService } from './ConfigService';
import { EncryptionService } from './EncryptionService';
export class ConfigModule {
    db;
    encryptionKey;
    name = 'config';
    _status = 'initializing';
    _configService = null;
    get status() {
        return this._status;
    }
    get configService() {
        if (!this._configService)
            throw new Error('ConfigModule not initialized');
        return this._configService;
    }
    constructor(db, encryptionKey) {
        this.db = db;
        this.encryptionKey = encryptionKey;
    }
    async initialize() {
        console.log('[ConfigModule] Initializing...');
        const configRepo = new ConfigRepository(this.db);
        const encryption = new EncryptionService(this.encryptionKey);
        this._configService = new ConfigService(configRepo, encryption);
        this._status = 'ready';
        console.log('[ConfigModule] Ready');
    }
    async shutdown() {
        this._status = 'initializing';
        console.log('[ConfigModule] Shut down');
    }
    getToolHandlers() {
        return new Map();
    }
    getToolDefinitions() {
        return [];
    }
}
//# sourceMappingURL=ConfigModule.js.map