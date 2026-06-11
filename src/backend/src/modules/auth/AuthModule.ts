/**
 * AuthModule — IModule implementation for authentication.
 * Implements TDD §5.2 modules/auth/AuthModule.ts.
 * Registers no MCP tools (auth is API-only, not exposed as MCP tools).
 */

import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler } from '../../types/tool';
import { AuthService } from './AuthService';
import { TokenService } from './TokenService';
import { PasswordService } from './PasswordService';
import { SsoService } from './SsoService';
import { UserRepository, IDatabase } from './UserRepository';
import { SessionRepository } from './SessionRepository';

export class AuthModule implements IModule {
  readonly name = 'auth';
  private _status: ModuleStatus = 'initializing';
  private _authService: AuthService | null = null;
  private _tokenService: TokenService | null = null;
  private _ssoService: SsoService | null = null;
  private _userRepo: UserRepository | null = null;

  get status(): ModuleStatus {
    return this._status;
  }

  get authService(): AuthService {
    if (!this._authService) throw new Error('AuthModule not initialized');
    return this._authService;
  }

  get tokenService(): TokenService {
    if (!this._tokenService) throw new Error('AuthModule not initialized');
    return this._tokenService;
  }

  get ssoService(): SsoService {
    if (!this._ssoService) throw new Error('AuthModule not initialized');
    return this._ssoService;
  }

  get userRepo(): UserRepository {
    if (!this._userRepo) throw new Error('AuthModule not initialized');
    return this._userRepo;
  }

  constructor(
    private readonly db: IDatabase,
    private readonly jwtSecret: string,
  ) {}

  async initialize(): Promise<void> {
    console.log('[AuthModule] Initializing...');

    this._userRepo = new UserRepository(this.db);
    const sessionRepo = new SessionRepository(this.db);
    this._tokenService = new TokenService(this.jwtSecret);
    const passwordService = new PasswordService();
    this._ssoService = new SsoService(this.db);

    this._authService = new AuthService(
      this._userRepo,
      sessionRepo,
      this._tokenService,
      passwordService,
    );

    this._status = 'ready';
    console.log('[AuthModule] Ready');
  }

  async shutdown(): Promise<void> {
    this._status = 'initializing';
    console.log('[AuthModule] Shut down');
  }

  // Auth module exposes no MCP tools — it's API-only
  getToolHandlers(): Map<string, ToolHandler> {
    return new Map();
  }

  getToolDefinitions(): ToolDefinition[] {
    return [];
  }
}
