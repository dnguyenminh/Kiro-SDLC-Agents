/**
 * Request logging middleware using pino.
 * Logs request method, path, status, and duration.
 */
export function createRequestLogger(logger) {
    return async (c, next) => {
        const start = Date.now();
        const method = c.req.method;
        const path = c.req.path;
        await next();
        const duration = Date.now() - start;
        const status = c.res.status;
        if (path === '/health') {
            logger.debug({ method, path, status, duration_ms: duration }, 'request');
        }
        else {
            logger.info({ method, path, status, duration_ms: duration }, 'request');
        }
    };
}
//# sourceMappingURL=request-logger.js.map