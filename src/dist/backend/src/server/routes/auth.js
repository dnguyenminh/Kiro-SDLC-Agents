/**
 * Auth routes — /api/auth/* endpoints.
 * Implements TDD §3.1 Authentication APIs.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { AuthError } from '../../modules/auth/AuthService';
const LoginSchema = z.object({
    username: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._]+$/),
    password: z.string().min(8).max(128),
});
const RefreshSchema = z.object({
    refresh_token: z.string().min(1),
});
const LogoutSchema = z.object({
    refresh_token: z.string().min(1),
});
const SsoAuthorizeSchema = z.object({
    code_challenge: z.string().min(43).max(128),
    redirect_uri: z.string().url(),
});
export function createAuthRoute(authModule) {
    const app = new Hono();
    app.post('/api/auth/login', async (c) => {
        try {
            const body = await c.req.json();
            const parsed = LoginSchema.safeParse(body);
            if (!parsed.success) {
                return c.json({
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', details: parsed.error.flatten() },
                }, 400);
            }
            const { username, password } = parsed.data;
            const userAgent = c.req.header('user-agent');
            const result = await authModule.authService.login(username, password, userAgent);
            return c.json(result, 200);
        }
        catch (err) {
            if (err instanceof AuthError) {
                return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.statusCode);
            }
            throw err;
        }
    });
    app.post('/api/auth/refresh', async (c) => {
        try {
            const body = await c.req.json();
            const parsed = RefreshSchema.safeParse(body);
            if (!parsed.success) {
                return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input.' } }, 400);
            }
            const result = await authModule.authService.refresh(parsed.data.refresh_token);
            return c.json(result, 200);
        }
        catch (err) {
            if (err instanceof AuthError) {
                return c.json({ error: { code: err.code, message: err.message } }, err.statusCode);
            }
            throw err;
        }
    });
    app.post('/api/auth/logout', async (c) => {
        const body = await c.req.json();
        const parsed = LogoutSchema.safeParse(body);
        if (!parsed.success) {
            return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input.' } }, 400);
        }
        authModule.authService.logout(parsed.data.refresh_token);
        return c.json({ message: 'Logged out successfully' }, 200);
    });
    app.post('/api/auth/sso/authorize', async (c) => {
        try {
            const body = await c.req.json();
            const parsed = SsoAuthorizeSchema.safeParse(body);
            if (!parsed.success) {
                return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input.' } }, 400);
            }
            const result = await authModule.ssoService.authorize(parsed.data.code_challenge, parsed.data.redirect_uri);
            return c.json(result, 200);
        }
        catch (err) {
            if (err instanceof Error && err.name === 'SsoError') {
                return c.json({ error: { code: 'SSO_ERROR', message: err.message } }, 400);
            }
            throw err;
        }
    });
    app.get('/api/auth/sso/callback', async (c) => {
        const code = c.req.query('code');
        const state = c.req.query('state');
        const errorParam = c.req.query('error');
        if (errorParam) {
            return c.html(`<html><body><h1>SSO Error</h1><p>${errorParam}</p></body></html>`, 400);
        }
        if (!code || !state) {
            return c.html('<html><body><h1>Invalid callback</h1></body></html>', 400);
        }
        const flow = authModule.ssoService.validateState(state);
        if (!flow) {
            return c.html('<html><body><h1>SSO session expired or invalid</h1></body></html>', 400);
        }
        return c.html(`<html><body><h1>SSO Authentication Successful</h1><p>Close this window.</p><script>window.close();</script></body></html>`);
    });
    return app;
}
//# sourceMappingURL=auth.js.map