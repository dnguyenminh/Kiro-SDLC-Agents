"use strict";
/**
 * WebviewDataFetcher — fetches JSON data from Backend /api/* endpoints.
 * Implements TDD §5.1 WebviewDataFetcher, FSD BR-23.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebviewDataFetcher = void 0;
class WebviewDataFetcher {
    connectionManager;
    constructor(connectionManager) {
        this.connectionManager = connectionManager;
    }
    async fetch(path) {
        if (!this.connectionManager.isConnected()) {
            return null;
        }
        try {
            const client = this.connectionManager.getHttpClient();
            return await client.fetchWebviewData(path);
        }
        catch {
            return null;
        }
    }
    async post(path, body) {
        if (!this.connectionManager.isConnected()) {
            return null;
        }
        try {
            const client = this.connectionManager.getHttpClient();
            return await client.postWebviewData(path, body);
        }
        catch {
            return null;
        }
    }
}
exports.WebviewDataFetcher = WebviewDataFetcher;
//# sourceMappingURL=WebviewDataFetcher.js.map