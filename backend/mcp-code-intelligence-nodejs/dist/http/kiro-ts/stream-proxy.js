"use strict";
/**
 * Stream Proxy — KSA-237
 * Forwards SSE events from upstream API to client with zero buffering.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpstreamError = void 0;
exports.formatSSEEvent = formatSSEEvent;
exports.writeSSEHeaders = writeSSEHeaders;
exports.proxyStream = proxyStream;
exports.proxyNonStreaming = proxyNonStreaming;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
/**
 * Format a single SSE event string.
 */
function formatSSEEvent(eventType, data) {
    const json = JSON.stringify(data);
    return `event: ${eventType}\ndata: ${json}\n\n`;
}
/**
 * Write SSE headers to response.
 */
function writeSSEHeaders(res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });
}
/**
 * Proxy a streaming request to the upstream API and forward SSE events to the client.
 * Returns a promise that resolves with collected content blocks when stream completes.
 */
function proxyStream(options, clientRes, onComplete, onError) {
    const parsedUrl = new URL(options.targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
            ...options.headers,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(options.body),
        },
    };
    const upstreamReq = transport.request(reqOptions, (upstreamRes) => {
        const statusCode = upstreamRes.statusCode || 500;
        // Handle non-200 upstream responses
        if (statusCode >= 400) {
            let errBody = '';
            upstreamRes.on('data', chunk => { errBody += chunk; });
            upstreamRes.on('end', () => {
                onError(new UpstreamError(statusCode, errBody));
            });
            return;
        }
        // Set SSE headers for client
        writeSSEHeaders(clientRes);
        // Forward SSE data with zero buffering (BR-05, BR-20)
        const contentBlocks = [];
        let buffer = '';
        upstreamRes.on('data', (chunk) => {
            buffer += chunk.toString();
            // Process complete SSE events (separated by \n\n)
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || ''; // Keep incomplete last part
            for (const part of parts) {
                if (part.trim().length === 0)
                    continue;
                // Forward raw SSE to client immediately (zero buffering)
                clientRes.write(part + '\n\n');
                // Parse for content collection
                const dataLine = part.split('\n').find(l => l.startsWith('data: '));
                if (dataLine) {
                    try {
                        const parsed = JSON.parse(dataLine.substring(6));
                        if (parsed.type === 'content_block_start' || parsed.type === 'content_block_delta') {
                            contentBlocks.push(parsed);
                        }
                    }
                    catch {
                        // Non-JSON data line — ignore
                    }
                }
            }
        });
        upstreamRes.on('end', () => {
            // Process any remaining buffer
            if (buffer.trim().length > 0) {
                clientRes.write(buffer + '\n\n');
            }
            clientRes.end();
            onComplete(contentBlocks);
        });
        upstreamRes.on('error', (err) => {
            // Send error event to client (EF-04)
            const errorEvent = formatSSEEvent('error', {
                type: 'error',
                error: { type: 'api_error', message: 'Upstream connection dropped' },
            });
            clientRes.write(errorEvent);
            clientRes.end();
            onError(err);
        });
    });
    // Handle client disconnect (BR-21)
    clientRes.on('close', () => {
        upstreamReq.destroy();
    });
    // Handle connection errors
    upstreamReq.on('error', (err) => {
        onError(new UpstreamError(502, err.message));
    });
    // Set timeout (120s for streaming)
    upstreamReq.setTimeout(120000, () => {
        upstreamReq.destroy();
        onError(new UpstreamError(504, 'Upstream timeout'));
    });
    // Send request body
    upstreamReq.write(options.body);
    upstreamReq.end();
    // Attach abort signal if provided
    if (options.signal) {
        options.signal.addEventListener('abort', () => {
            upstreamReq.destroy();
        });
    }
}
/**
 * Send a non-streaming request to upstream and return the full response.
 */
async function proxyNonStreaming(options) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(options.targetUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const transport = isHttps ? https : http;
        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                ...options.headers,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(options.body),
            },
        };
        const req = transport.request(reqOptions, (res) => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => resolve({ status: res.statusCode || 500, body }));
            res.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(120000, () => { req.destroy(); reject(new Error('Upstream timeout')); });
        req.write(options.body);
        req.end();
    });
}
class UpstreamError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.name = 'UpstreamError';
        this.statusCode = statusCode;
    }
}
exports.UpstreamError = UpstreamError;
//# sourceMappingURL=stream-proxy.js.map