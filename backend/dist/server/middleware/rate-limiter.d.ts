/**
 * Simple in-memory rate limiter middleware for admin API.
 * Sliding window: max 100 requests per minute per IP.
 * Lightweight — no external dependencies.
 */
import type { Context, Next } from 'hono';
/**
 * Rate limiting middleware — 100 requests/minute per IP.
 * Applied to /api/admin/* endpoints.
 */
export declare function rateLimiter(c: Context, next: Next): Promise<Response | void>;
