"use strict";
/**
 * HTTP routes for model management — list, download, status, switch.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleModelRoute = handleModelRoute;
function handleModelRoute(req, url, res, modelManager) {
    if (!url.pathname.startsWith('/api/models'))
        return false;
    if (!modelManager) {
        sendJson(res, 503, { error: 'Model manager not initialized' });
        return true;
    }
    if (req.method === 'GET' && url.pathname === '/api/models/list') {
        const result = modelManager.execute({ action: 'list' });
        sendJson(res, 200, JSON.parse(result));
        return true;
    }
    if (req.method === 'GET' && url.pathname === '/api/models/status') {
        const result = modelManager.execute({ action: 'status' });
        sendJson(res, 200, JSON.parse(result));
        return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/models/download') {
        readBody(req).then((body) => {
            const args = { ...JSON.parse(body), action: 'download' };
            const result = modelManager.execute(args);
            const parsed = JSON.parse(result);
            sendJson(res, parsed.success ? 200 : 400, parsed);
        }).catch(() => sendJson(res, 400, { error: 'Invalid body' }));
        return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/models/switch') {
        readBody(req).then((body) => {
            const args = { ...JSON.parse(body), action: 'switch' };
            const result = modelManager.execute(args);
            const parsed = JSON.parse(result);
            sendJson(res, parsed.success ? 200 : 400, parsed);
        }).catch(() => sendJson(res, 400, { error: 'Invalid body' }));
        return true;
    }
    return false;
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}
function sendJson(res, code, data) {
    const body = JSON.stringify(data);
    res.writeHead(code, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(body);
}
//# sourceMappingURL=model-routes.js.map