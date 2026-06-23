/**
 * Auth guard middleware — validates JWT Bearer token on all protected routes.
 * Implements TDD §5.4 Middleware Chain, FSD BR-1.
 */
const PUBLIC_PATHS = [
    '/health',
    '/api/auth/login',
    '/api/auth/sso/authorize',
    '/api/auth/sso/callback',
    '/api/auth/refresh',
];
export function createAuthGuard(tokenService) {
    return async function authGuard(c, next) {
        const path = c.req.path;
        if (PUBLIC_PATHS.some((p) => path.startsWith(p))) {
            await next();
            return;
        }
        const authHeader = c.req.header('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required.' } }, 401);
        }
        const token = authHeader.slice(7);
        try {
            const payload = await tokenService.verifyAccessToken(token);
            c.set('authPayload', payload);
            c.set('userId', payload.userId);
            c.set('userRole', payload.role);
            c.set('userProjects', payload.projects);
            await next();
        }
        catch {
            return c.json({ error: { code: 'AUTH_TOKEN_INVALID', message: 'Invalid or expired token.' } }, 401);
        }
    };
}
export function getAuthPayload(c) {
    const payload = c.get('authPayload');
    if (!payload) {
        throw new Error('Auth payload not found in context.');
    }
    return payload;
}
export function requireAdmin(c) {
    const role = c.get('userRole');
    if (role !== 'admin') {
        return c.json({ error: { code: 'AUTH_FORBIDDEN', message: 'Admin access required.' } }, 403);
    }
    return null;
}
//# sourceMappingURL=auth-guard.js.map