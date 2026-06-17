"use strict";
/**
 * HttpClient — lightweight HTTP client for Extension to Backend communication.
 * Implements TDD §6.1 Communication Protocol.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = exports.HttpClient = void 0;
class HttpClient {
    config;
    constructor(config) {
        this.config = config;
    }
    async health() {
        const response = await this.doFetch('/health', {
            method: 'GET',
            timeout: this.config.healthTimeout,
        });
        return response.json();
    }
    async listTools() {
        const response = await this.doFetch('/mcp/tools/list', {
            method: 'GET',
            timeout: this.config.toolCallTimeout,
        });
        return response.json();
    }
    async callTool(request) {
        const response = await this.doFetch('/mcp/tools/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
            timeout: this.config.toolCallTimeout,
        });
        return response.json();
    }
    async fetchWebviewData(path) {
        const response = await this.doFetch(path, {
            method: 'GET',
            timeout: this.config.webviewTimeout,
        });
        const json = await response.json();
        return json.data;
    }
    async postWebviewData(path, body) {
        const response = await this.doFetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            timeout: this.config.webviewTimeout,
        });
        const json = await response.json();
        return json.data;
    }
    async doFetch(path, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout);
        try {
            const url = this.config.baseUrl + path;
            const response = await fetch(url, {
                method: options.method,
                headers: options.headers,
                body: options.body,
                signal: controller.signal,
            });
            if (!response.ok && response.status >= 500) {
                const errorBody = await response.text();
                throw new HttpError(response.status, errorBody);
            }
            return response;
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
}
exports.HttpClient = HttpClient;
class HttpError extends Error {
    statusCode;
    body;
    constructor(statusCode, body) {
        super('HTTP ' + statusCode + ': ' + body);
        this.statusCode = statusCode;
        this.body = body;
        this.name = 'HttpError';
    }
}
exports.HttpError = HttpError;
//# sourceMappingURL=HttpClient.js.map