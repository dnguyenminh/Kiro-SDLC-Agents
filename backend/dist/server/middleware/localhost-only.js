/**
 * Middleware to reject non-localhost requests.
 * Security: Backend only serves 127.0.0.1 connections (BR-35, BR-37).
 */
export const localhostOnly = async (c, next) => {
    const host = c.req.header('host') || '';
    const isLocalhost = host.startsWith('127.0.0.1') ||
        host.startsWith('localhost') ||
        host.startsWith('[::1]');
    if (!isLocalhost && host !== '') {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Only localhost connections allowed' } }, 403);
    }
    await next();
};
//# sourceMappingURL=localhost-only.js.map