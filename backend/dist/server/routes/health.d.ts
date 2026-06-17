/**
 * Health endpoint — GET /health
 * Returns backend status, version, uptime, and module health.
 * Implements: UC-1, UC-3, UC-4, BR-13, BR-27, BR-30
 */
import { Hono } from 'hono';
import type { ModuleRegistry } from '../../modules/ModuleRegistry.js';
export declare function createHealthRoute(registry: ModuleRegistry, version: string): Hono;
