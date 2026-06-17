/**
 * Global error handler middleware.
 * Implements TDD §5.6 Error Handling Strategy.
 */
import { HTTPException } from 'hono/http-exception';
export function errorHandler(err, c) {
    console.error('[ErrorHandler]', err.message, err.stack);
    if (err instanceof HTTPException) {
        return c.json({
            error: {
                code: 'HTTP_ERROR',
                message: err.message,
            },
        }, err.status);
    }
    return c.json({
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
        },
    }, 500);
}
//# sourceMappingURL=error-handler.js.map