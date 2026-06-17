/**
 * Request logging middleware using pino.
 * Logs request method, path, status, and duration.
 */
import type { MiddlewareHandler } from 'hono';
import type { Logger } from 'pino';
export declare function createRequestLogger(logger: Logger): MiddlewareHandler;
