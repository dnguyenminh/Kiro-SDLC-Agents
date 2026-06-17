/**
 * Admin Portal routes — /admin (SPA) + /api/admin/* (API)
 * Features: Real JWT auth, persistent RBAC (SQLite), full User CRUD.
 * All on same port as MCP backend (48721).
 */
import { Hono } from 'hono';
import type { Logger } from 'pino';
export declare function createAdminRoute(logger: Logger): Hono;
