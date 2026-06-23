"use strict";
/**
 * HttpClient — Auth-injecting HTTP wrapper for backend communication.
 * Handles token injection, 401 retry, timeouts, and streaming.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = exports.HttpError = void 0;
class HttpError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "HttpError";
    }
}
exports.HttpError = HttpError;
class HttpClient {
    _baseUrl;
    authManager;
    constructor(_baseUrl, authManager) {
        this._baseUrl = _baseUrl;
        this.authManager = authManager;
    }
    get baseUrl() {
        return this._baseUrl;
    }
    set baseUrl(url) {
        this._baseUrl = url;
    }
    async getAuthHeaders() {
        const token = await this.authManager.getAccessToken();
        const headers = { "Content-Type": "application/json" };
        if (token) {
            headers["Authorization"] = "Bearer " + token;
        }
        return headers;
    }
    async get(path, timeout, _retried = false) {
        const headers = await this.getAuthHeaders();
        const url = this._baseUrl + path;
        const response = await fetch(url, {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(timeout || 10000),
        });
        if (response.status === 401 && !_retried) {
            await this.authManager.refreshToken();
            return this.get(path, timeout, true);
        }
        if (!response.ok) {
            throw new HttpError(response.status, await response.text());
        }
        return response.json();
    }
    async post(path, body, timeout, _retried = false) {
        const headers = await this.getAuthHeaders();
        const url = this._baseUrl + path;
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeout || 10000),
        });
        if (response.status === 401 && !_retried) {
            await this.authManager.refreshToken();
            return this.post(path, body, timeout, true);
        }
        if (!response.ok) {
            throw new HttpError(response.status, await response.text());
        }
        return response.json();
    }
    async callTool(name, args) {
        return this.post("/mcp/tools/call", { tool_name: name, arguments: args }, 300000);
    }
    async stream(path, body, timeout) {
        const headers = await this.getAuthHeaders();
        const url = this._baseUrl + path;
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeout || 120000),
        });
        if (response.status === 401) {
            await this.authManager.refreshToken();
            return this.stream(path, body, timeout);
        }
        if (!response.ok) {
            throw new HttpError(response.status, await response.text());
        }
        if (!response.body) {
            throw new HttpError(0, "No response body for streaming");
        }
        return response.body;
    }
    /**
     * Simple health check — GET /health, returns true if 200.
     */
    async healthCheck(timeout) {
        try {
            const url = this._baseUrl + "/health";
            const response = await fetch(url, {
                method: "GET",
                signal: AbortSignal.timeout(timeout || 5000),
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
}
exports.HttpClient = HttpClient;
//# sourceMappingURL=HttpClient.js.map