/**
 * ConfigModule — IModule implementation for MCP server configuration.
 * Implements TDD §5.2 modules/config/ConfigModule.ts.
 */
import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler } from '../../types/tool';
import { IDatabase } from '../auth/UserRepository';
import { ConfigService } from './ConfigService';
export declare class ConfigModule implements IModule {
    private readonly db;
    private readonly encryptionKey;
    readonly name = "config";
    private _status;
    private _configService;
    get status(): ModuleStatus;
    get configService(): ConfigService;
    constructor(db: IDatabase, encryptionKey: string);
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
}
//# sourceMappingURL=ConfigModule.d.ts.map