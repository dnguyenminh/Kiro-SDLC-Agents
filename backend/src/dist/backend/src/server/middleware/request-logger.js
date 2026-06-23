/**
 * Request logger middleware — logs incoming requests.
 * Implements TDD §9.1 Logging.
 */
export async function requestLogger(c, next) {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;
    await next();
    const duration = Date.now() - start;
    const status = c.res.status;
    console.log('[HTTP] ' + method + ' ' + path + ' ' + status + ' ' + duration + 'ms');
}
//# sourceMappingURL=request-logger.js.map