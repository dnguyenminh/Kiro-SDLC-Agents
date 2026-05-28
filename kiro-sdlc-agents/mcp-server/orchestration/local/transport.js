"use strict";
/**
 * Transport detection and server process interface.
 * Determines whether a server entry should use stdio or httpStream transport.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectTransport = detectTransport;
/**
 * Detect transport type from server entry config.
 * - url present, no command → httpStream
 * - command present, no url → stdio
 * - both present → use transportType field (default httpStream)
 * - neither → stdio (will fail at spawn, preserves existing error behavior)
 */
function detectTransport(entry) {
    if (entry.url && !entry.command)
        return 'httpStream';
    if (entry.command && !entry.url)
        return 'stdio';
    if (entry.url && entry.command)
        return entry.transportType === 'stdio' ? 'stdio' : 'httpStream';
    return 'stdio';
}
//# sourceMappingURL=transport.js.map