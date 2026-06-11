/**
 * ConfigModule — IModule implementation for MCP server configuration.
 * Implements TDD §5.2 modules/config/ConfigModule.ts.
 */

import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler } from '../../types/tool';
import { IDatabase } from '../auth/UserRepository';
import { ConfigRepository } from './ConfigRepository';
import { ConfigService } from './ConfigService';
import { EncryptionService } from './EncryptionService';

export class ConfigModule implements IModule {
  readonly name = 'config';
  private _status: ModuleStatus = 'initializing';
  private _configService: ConfigService | null = null;

  get status(): ModuleStatus {
    return this._status;
  }

  get configService(): ConfigService {
    if (!this._configService) throw new Error('ConfigModule not initialized');
    return this._configService;
  }

  constructor(
    private readonly db: IDatabase,
    private readonly encryptionKey: string,
  ) {}

  async initialize(): Promise<void> {
    console.log('[ConfigModule] Initializing...');

    const configRepo = new ConfigRepository(this.db);
    const encryption = new EncryptionService(this.encryptionKey);
    this._configService = new ConfigService(configRepo, encryption);

    this._status = 'ready';
    console.log('[ConfigModule] Ready');
  }

  async shutdown(): Promise<void> {
    this._status = 'initializing';
    console.log('[ConfigModule] Shut down');
  }

  getToolHandlers(): Map<string, ToolHandler> {
    return new Map();
  }

  getToolDefinitions(): ToolDefinition[] {
    return [];
  }
}
