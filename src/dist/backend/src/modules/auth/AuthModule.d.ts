/**
 * AuthModule — IModule implementation for authentication.
 * Implements TDD §5.2 modules/auth/AuthModule.ts.
 * Registers no MCP tools (auth is API-only, not exposed as MCP tools).
 */
import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler } from '../../types/tool';
import { AuthService } from './AuthService';
import { TokenService } from './TokenService';
import { SsoService } from './SsoService';
import { UserRepository, IDatabase } from './UserRepository';
export declare class AuthModule implements IModule {
    private readonly db;
    private readonly jwtSecret;
    readonly name = "auth";
    private _status;
    private _authService;
    private _tokenService;
    private _ssoService;
    private _userRepo;
    get status(): ModuleStatus;
    get authService(): AuthService;
    get tokenService(): TokenService;
    get ssoService(): SsoService;
    get userRepo(): UserRepository;
    constructor(db: IDatabase, jwtSecret: string);
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
}
//# sourceMappingURL=AuthModule.d.ts.map