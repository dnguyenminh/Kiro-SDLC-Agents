/**
 * HttpClient — lightweight HTTP client for Extension to Remote Backend.
 * KSA-292: Added auth header injection, configurable URL, 401 handling.
 * Implements TDD §4.2 HttpClient, §6.2 Auth Header Injection.
 */
export class HttpClient {
    baseUrl;
    authManager;
    healthTimeout;
    toolCallTimeout;
    webviewTimeout;
    chatTimeout;
    uploadTimeout;
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/$/, ''); // strip trailing slash
        this.authManager = config.authManager;
        this.healthTimeout = config.healthTimeout ?? 3000;
        this.toolCallTimeout = config.toolCallTimeout ?? 300000;
        this.webviewTimeout = config.webviewTimeout ?? 10000;
        this.chatTimeout = config.chatTimeout ?? 120000;
        this.uploadTimeout = config.uploadTimeout ?? 600000;
    }
    get url() {
        return this.baseUrl;
    }
    async health() {
        const response = await this.doFetch('/health', {
            method: 'GET',
            timeout: this.healthTimeout,
            skipAuth: true, // health check doesn't need auth
        });
        return response.json();
    }
    async listTools() {
        const response = await this.doFetch('/mcp/tools/list', {
            method: 'GET',
            timeout: this.toolCallTimeout,
        });
        return response.json();
    }
    async callTool(request) {
        const response = await this.doFetch('/mcp/tools/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
            timeout: this.toolCallTimeout,
        });
        return response.json();
    }
    async fetchWebviewData(path) {
        const response = await this.doFetch(path, {
            method: 'GET',
            timeout: this.webviewTimeout,
        });
        const json = await response.json();
        return json.data;
    }
    async postWebviewData(path, body) {
        const response = await this.doFetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            timeout: this.webviewTimeout,
        });
        const json = await response.json();
        return json.data;
    }
    async post(path, body) {
        const response = await this.doFetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            timeout: this.webviewTimeout,
        });
        return response.json();
    }
    async postMultipart(path, formData, _options) {
        const headers = await this.getAuthHeaders();
        // Remove Content-Type for FormData — browser/node sets boundary automatically
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.uploadTimeout);
        try {
            const response = await fetch(this.baseUrl + path, {
                method: 'POST',
                headers,
                body: formData,
                signal: controller.signal,
            });
            if (response.status === 401) {
                throw new AuthenticationRequiredError();
            }
            if (!response.ok) {
                throw new HttpError(response.status, await response.text());
            }
            return response.json();
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    async streamChat(path, body) {
        const headers = await this.getAuthHeaders();
        headers['Content-Type'] = 'application/json';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.chatTimeout);
        try {
            const response = await fetch(this.baseUrl + path, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            if (response.status === 401) {
                clearTimeout(timeoutId);
                throw new AuthenticationRequiredError();
            }
            if (!response.ok) {
                clearTimeout(timeoutId);
                throw new HttpError(response.status, await response.text());
            }
            if (!response.body) {
                clearTimeout(timeoutId);
                throw new HttpError(500, 'No response body for streaming');
            }
            // Don't clear timeout here — stream may be long-lived
            return response.body;
        }
        catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    async getAuthHeaders() {
        const token = await this.authManager.getAccessToken();
        const headers = {};
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        return headers;
    }
    async doFetch(path, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout);
        try {
            const authHeaders = options.skipAuth ? {} : await this.getAuthHeaders();
            const headers = { ...authHeaders, ...options.headers };
            const url = this.baseUrl + path;
            const response = await fetch(url, {
                method: options.method,
                headers,
                body: options.body,
                signal: controller.signal,
            });
            if (response.status === 401) {
                throw new AuthenticationRequiredError();
            }
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                throw new RateLimitedError(retryAfter ? parseInt(retryAfter, 10) : 60);
            }
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
export class HttpError extends Error {
    statusCode;
    body;
    constructor(statusCode, body) {
        super('HTTP ' + statusCode + ': ' + body);
        this.statusCode = statusCode;
        this.body = body;
        this.name = 'HttpError';
    }
}
export class AuthenticationRequiredError extends Error {
    constructor() {
        super('Authentication required — token expired or invalid');
        this.name = 'AuthenticationRequiredError';
    }
}
export class RateLimitedError extends Error {
    retryAfterSeconds;
    constructor(retryAfterSeconds) {
        super('Rate limited — retry after ' + retryAfterSeconds + 's');
        this.retryAfterSeconds = retryAfterSeconds;
        this.name = 'RateLimitedError';
    }
}
//# sourceMappingURL=HttpClient.js.map