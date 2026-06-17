/**
 * Health route — GET /health.
 * Implements TDD §3.2, FSD UC-1, BR-13, BR-27, BR-30.
 */
import { Hono } from 'hono';
import { ModuleRegistry } from '../../modules/ModuleRegistry';
export declare function createHealthRoute(moduleRegistry: ModuleRegistry, version: string): Hono;
//# sourceMappingURL=health.d.ts.map