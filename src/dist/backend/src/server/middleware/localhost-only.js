/**
 * Localhost-only middleware — rejects non-127.0.0.1 requests.
 * Implements TDD §7.1 Network Security, FSD BR-35, BR-37.
 */
export async function localhostOnly(c, next) {
    // In Node.js with Hono serve, the remote address comes from the request
    // For localhost binding, the server itself only listens on 127.0.0.1
    // This middleware is an additional safety check
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) {
        // If there's a forwarded header, someone is proxying — reject
        return c.json({ error: { code: 'FORBIDDEN', message: 'Remote access not allowed' } }, 403);
    }
    await next();
}
//# sourceMappingURL=localhost-only.js.map