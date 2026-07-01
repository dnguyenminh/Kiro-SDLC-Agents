/**
 * WebviewDataFetcher — fetches JSON data from Backend /api/* endpoints.
 * Implements TDD §5.1 WebviewDataFetcher, FSD BR-23.
 */
export class WebviewDataFetcher {
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
//# sourceMappingURL=WebviewDataFetcher.js.map