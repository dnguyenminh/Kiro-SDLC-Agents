"use strict";
/**
 * SSE (Server-Sent Events) handler — pushes KB change events to connected clients.
 * Endpoint: GET /api/events
 *
 * Protocol: text/event-stream
 * - Sends keepalive every 30s
 * - Pushes KB events as they occur
 * - Client reconnects automatically (EventSource API)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSseEvents = handleSseEvents;
exports.closeSseConnections = closeSseConnections;
exports.getSseConnectionCount = getSseConnectionCount;
const kb_event_emitter_js_1 = require("./kb-event-emitter.js");
/** Active SSE connections for cleanup on shutdown. */
const activeConnections = new Set();
/**
 * Handle SSE connection for /api/events.
 * Keeps connection open and streams KB change events.
 */
function handleSseEvents(req, res) {
    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no', // Disable nginx buffering if proxied
    });
    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
    // Track connection
    activeConnections.add(res);
    // Subscribe to KB events
    const emitter = kb_event_emitter_js_1.KbEventEmitter.getInstance();
    const unsubscribe = emitter.subscribe((event) => {
        if (res.writable) {
            res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        }
    });
    // Keepalive every 30s to prevent connection timeout
    const keepalive = setInterval(() => {
        if (res.writable) {
            res.write(`: keepalive\n\n`);
        }
    }, 30000);
    // Cleanup on disconnect
    const cleanup = () => {
        clearInterval(keepalive);
        unsubscribe();
        activeConnections.delete(res);
    };
    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('error', cleanup);
}
/** Close all active SSE connections (called on server shutdown). */
function closeSseConnections() {
    for (const res of activeConnections) {
        try {
            res.end();
        }
        catch { /* ignore */ }
    }
    activeConnections.clear();
}
/** Get count of active SSE connections. */
function getSseConnectionCount() {
    return activeConnections.size;
}
//# sourceMappingURL=sse-handler.js.map