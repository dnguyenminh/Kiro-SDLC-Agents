/**
 * Adapter Utils — KSA-237
 * Small shared helpers for adapters (kept separate to avoid circular imports
 * between chat-handler and the adapters).
 */

import * as http from 'http';

/** Write an Anthropic-format error response (no-op if headers already sent). */
export function sendError(
  res: http.ServerResponse,
  statusCode: number,
  errorType: string,
  message: string,
): void {
  if (res.headersSent) return;
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    type: 'error',
    error: { type: errorType, message },
  }));
}
