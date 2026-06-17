/**
 * Auth guard middleware — validates JWT Bearer token on all protected routes.
 * Implements TDD §5.4 Middleware Chain, FSD BR-1.
 */
import { Context, Next } from 'hono';
import { TokenService } from '../../modules/auth/TokenService';
import { AuthPayload } from '../../modules/auth/types';
export declare function createAuthGuard(tokenService: TokenService): (c: Context, next: Next) => Promise<Response | void>;
export declare function getAuthPayload(c: Context): AuthPayload;
export declare function requireAdmin(c: Context): Response | null;
//# sourceMappingURL=auth-guard.d.ts.map