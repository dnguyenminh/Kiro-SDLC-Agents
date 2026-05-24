/**
 * Port conflict bug fix tests — ViewerServer port release on shutdown.
 *
 * Bug: When MCP server is reconnected, old instance doesn't release the HTTP
 * viewer port, causing "port already in use" error.
 *
 * Fix: ViewerServer.stop() calls server.close() which releases the port.
 * cleanup() in index.ts calls _viewerServer.stop() on stdin close + SIGTERM/SIGINT.
 *
 * Run: node --experimental-specifier-resolution=node dist/test-port-conflict.js
 * (after: npx tsc)
 */
export {};
//# sourceMappingURL=test-port-conflict.d.ts.map