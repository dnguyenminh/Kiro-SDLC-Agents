"use strict";
/**
 * Models Handler — KSA-237 (Adapter Pattern)
 * Handler for GET /v1/models — lists available models in Anthropic format.
 *
 * Auth is relaxed like the gateway: valid Kiro SSO -> Kiro models; a real
 * `sk-ant-` key -> Anthropic passthrough models; no key on localhost -> still
 * served (Kiro models if SSO present, else Anthropic fallback list).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleModelsRoute = handleModelsRoute;
const auth_resolver_js_1 = require("./auth-resolver.js");
const index_js_1 = require("./adapters/index.js");
/**
 * Handle GET /v1/models (also accepts the `/anthropic` prefix, stripped by the
 * router). Returns true if the request was handled, false if route didn't match.
 */
function handleModelsRoute(req, res) {
    if (req.method !== 'GET')
        return false;
    // Accept an optional `/anthropic` prefix (mirrors handleChatRoute).
    let url = req.url || '';
    const qIdx = url.indexOf('?');
    let pathOnly = qIdx >= 0 ? url.slice(0, qIdx) : url;
    if (pathOnly.startsWith('/anthropic/')) {
        pathOnly = pathOnly.slice('/anthropic'.length);
    }
    else if (pathOnly === '/anthropic') {
        pathOnly = '/v1/models';
    }
    if (pathOnly !== '/v1/models')
        return false;
    const apiKeyHeader = req.headers['x-api-key'] || '';
    void listModelsResponse(apiKeyHeader, res);
    return true;
}
async function listModelsResponse(apiKeyHeader, res) {
    // Resolve auth with the same relaxed gateway rules used for /v1/messages.
    let auth;
    try {
        auth = (0, auth_resolver_js_1.resolveAuth)(apiKeyHeader);
    }
    catch (err) {
        if (err instanceof auth_resolver_js_1.AuthenticationError) {
            sendModelsError(res, 401, 'authentication_error', err.message);
            return;
        }
        throw err;
    }
    // For Kiro mode, freshen the token (best effort — listing models works even
    // without a live token since the list is static).
    if (auth.mode === 'kiro') {
        try {
            const fresh = await (0, auth_resolver_js_1.ensureFreshKiroToken)();
            if (fresh)
                auth = (0, auth_resolver_js_1.buildKiroAuthResult)(fresh);
        }
        catch (err) {
            if (!(err instanceof auth_resolver_js_1.RefreshTokenExpiredError)) {
                console.error('[kiro-ts] models-handler token refresh failed:', err.message);
            }
            // Continue regardless — model listing does not require a live call.
        }
    }
    try {
        const adapter = (0, index_js_1.selectAdapter)(auth);
        const models = await adapter.listModels();
        const payload = (0, index_js_1.buildModelsListResponse)(models);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
    }
    catch (err) {
        sendModelsError(res, 500, 'api_error', err?.message || 'Failed to list models');
    }
}
function sendModelsError(res, statusCode, errorType, message) {
    if (res.headersSent)
        return;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        type: 'error',
        error: { type: errorType, message },
    }));
}
//# sourceMappingURL=models-handler.js.map