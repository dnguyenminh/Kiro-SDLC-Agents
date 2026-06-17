/**
 * Global error boundary middleware.
 * Catches unhandled errors and returns structured error responses.
 */
import type { ErrorHandler } from 'hono';
import type { Logger } from 'pino';
export declare function createErrorHandler(logger: Logger): ErrorHandler;
