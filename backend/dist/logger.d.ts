/**
 * Minimal structured logger interface.
 * In production, replace with pino or winston.
 */
export interface Logger {
    trace(msg: string, data?: Record<string, unknown>): void;
    debug(msg: string, data?: Record<string, unknown>): void;
    info(msg: string, data?: Record<string, unknown>): void;
    warn(msg: string, data?: Record<string, unknown>): void;
    error(msg: string, data?: Record<string, unknown>): void;
}
/**
 * Default console-based logger with JSON structured output.
 */
export declare const logger: Logger;
