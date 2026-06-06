/**
 * Stream Proxy — KSA-237
 * Forwards SSE events from upstream API to client with zero buffering.
 */
import * as http from 'http';
import { ProxyOptions } from './types.js';
/**
 * Format a single SSE event string.
 */
export declare function formatSSEEvent(eventType: string, data: unknown): string;
/**
 * Write SSE headers to response.
 */
export declare function writeSSEHeaders(res: http.ServerResponse): void;
/**
 * Proxy a streaming request to the upstream API and forward SSE events to the client.
 * Returns a promise that resolves with collected content blocks when stream completes.
 */
export declare function proxyStream(options: ProxyOptions, clientRes: http.ServerResponse, onComplete: (contentBlocks: unknown[]) => void, onError: (error: Error) => void): void;
/**
 * Send a non-streaming request to upstream and return the full response.
 */
export declare function proxyNonStreaming(options: ProxyOptions): Promise<{
    status: number;
    body: string;
}>;
export declare class UpstreamError extends Error {
    readonly statusCode: number;
    constructor(statusCode: number, message: string);
}
//# sourceMappingURL=stream-proxy.d.ts.map