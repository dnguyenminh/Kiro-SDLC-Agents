/**
 * Stream Proxy — KSA-237
 * Forwards SSE events from upstream API to client with zero buffering.
 */

import * as http from 'http';
import * as https from 'https';
import { ProxyOptions, SSEEvent } from './types.js';

/**
 * Format a single SSE event string.
 */
export function formatSSEEvent(eventType: string, data: unknown): string {
  const json = JSON.stringify(data);
  return `event: ${eventType}\ndata: ${json}\n\n`;
}

/**
 * Write SSE headers to response.
 */
export function writeSSEHeaders(res: http.ServerResponse): void {
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
export function proxyStream(
  options: ProxyOptions,
  clientRes: http.ServerResponse,
  onComplete: (contentBlocks: unknown[]) => void,
  onError: (error: Error) => void,
): void {
  const parsedUrl = new URL(options.targetUrl);
  const isHttps = parsedUrl.protocol === 'https:';
  const transport = isHttps ? https : http;

  const reqOptions: http.RequestOptions = {
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
    const contentBlocks: unknown[] = [];
    let buffer = '';

    upstreamRes.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();

      // Process complete SSE events (separated by \n\n)
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || ''; // Keep incomplete last part

      for (const part of parts) {
        if (part.trim().length === 0) continue;

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
          } catch {
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
export async function proxyNonStreaming(options: ProxyOptions): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(options.targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    const reqOptions: http.RequestOptions = {
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

export class UpstreamError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'UpstreamError';
    this.statusCode = statusCode;
  }
}
