/**
 * Request logger middleware — logs incoming requests.
 * Implements TDD §9.1 Logging.
 */

import { Context, Next } from 'hono';

export async function requestLogger(c: Context, next: Next): Promise<void> {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;
  console.log('[HTTP] ' + method + ' ' + path + ' ' + status + ' ' + duration + 'ms');
}
