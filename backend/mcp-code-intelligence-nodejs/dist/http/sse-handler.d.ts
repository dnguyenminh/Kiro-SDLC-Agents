/**
 * SSE (Server-Sent Events) handler — pushes KB change events to connected clients.
 * Endpoint: GET /api/events
 *
 * Protocol: text/event-stream
 * - Sends keepalive every 30s
 * - Pushes KB events as they occur
 * - Client reconnects automatically (EventSource API)
 */
import * as http from 'http';
/**
 * Handle SSE connection for /api/events.
 * Keeps connection open and streams KB change events.
 */
export declare function handleSseEvents(req: http.IncomingMessage, res: http.ServerResponse): void;
/** Close all active SSE connections (called on server shutdown). */
export declare function closeSseConnections(): void;
/** Get count of active SSE connections. */
export declare function getSseConnectionCount(): number;
//# sourceMappingURL=sse-handler.d.ts.map