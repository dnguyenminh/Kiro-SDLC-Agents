"use strict";
/**
 * Adapter Utils — KSA-237
 * Small shared helpers for adapters (kept separate to avoid circular imports
 * between chat-handler and the adapters).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = sendError;
/** Write an Anthropic-format error response (no-op if headers already sent). */
function sendError(res, statusCode, errorType, message) {
    if (res.headersSent)
        return;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        type: 'error',
        error: { type: errorType, message },
    }));
}
//# sourceMappingURL=adapter-utils.js.map