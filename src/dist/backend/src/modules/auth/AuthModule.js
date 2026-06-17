/**
 * AuthModule — IModule implementation for authentication.
 * Implements TDD §5.2 modules/auth/AuthModule.ts.
 * Registers no MCP tools (auth is API-only, not exposed as MCP tools).
 */
import { AuthService } from './AuthService';
import { TokenService } from './TokenService';
import { PasswordService } from './PasswordService';
import { SsoService } from './SsoService';
import { UserRepository } from './UserRepository';
import { SessionRepository } from './SessionRepository';
export class AuthModule {
    db;
    jwtSecret;
    name = 'auth';
    _status = 'initializing';
    _authService = null;
    _tokenService = null;
    _ssoService = null;
    _userRepo = null;
    get status() {
        return this._status;
    }
    get authService() {
        if (!this._authService)
            throw new Error('AuthModule not initialized');
        return this._authService;
    }
    get tokenService() {
        if (!this._tokenService)
            throw new Error('AuthModule not initialized');
        return this._tokenService;
    }
    get ssoService() {
        if (!this._ssoService)
            throw new Error('AuthModule not initialized');
        return this._ssoService;
    }
    get userRepo() {
        if (!this._userRepo)
            throw new Error('AuthModule not initialized');
        return this._userRepo;
    }
    constructor(db, jwtSecret) {
        this.db = db;
        this.jwtSecret = jwtSecret;
    }
    async initialize() {
        console.log('[AuthModule] Initializing...');
        this._userRepo = new UserRepository(this.db);
        const sessionRepo = new SessionRepository(this.db);
        this._tokenService = new TokenService(this.jwtSecret);
        const passwordService = new PasswordService();
        this._ssoService = new SsoService(this.db);
        this._authService = new AuthService(this._userRepo, sessionRepo, this._tokenService, passwordService);
        this._status = 'ready';
        console.log('[AuthModule] Ready');
    }
    async shutdown() {
        this._status = 'initializing';
        console.log('[AuthModule] Shut down');
    }
    // Auth module exposes no MCP tools — it's API-only
    getToolHandlers() {
        return new Map();
    }
    getToolDefinitions() {
        return [];
    }
}
//# sourceMappingURL=AuthModule.js.map