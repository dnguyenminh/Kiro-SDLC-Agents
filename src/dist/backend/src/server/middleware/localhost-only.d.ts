/**
 * Localhost-only middleware — rejects non-127.0.0.1 requests.
 * Implements TDD §7.1 Network Security, FSD BR-35, BR-37.
 */
import { Context, Next } from 'hono';
export declare function localhostOnly(c: Context, next: Next): Promise<Response | void>;
//# sourceMappingURL=localhost-only.d.ts.map