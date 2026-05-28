/**
 * JSON-RPC 2.0 over HTTP POST — sends requests to upstream httpStream MCP servers.
 * Handles both JSON and SSE response formats.
 * Manages Mcp-Session-Id header automatically.
 */

export class HttpJsonRpc {
  private url: string;
  private sessionId: string | null = null;
  private nextId = 1;

  constructor(url: string) { this.url = url; }

  /** Send JSON-RPC request via HTTP POST and await response with timeout. */
  async sendRequest(method: string, params: any, timeoutMs: number): Promise<any> {
    const id = this.nextId++;
    const body = { jsonrpc: '2.0', id, method, params };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      // Capture session ID from response
      const sid = response.headers.get('mcp-session-id');
      if (sid) this.sessionId = sid;

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${response.statusText}${text ? ' — ' + text.slice(0, 200) : ''}`);
      }

      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('text/event-stream')) {
        return this.parseSSE(await response.text());
      }

      const json = await response.json() as any;
      if (json.error) {
        throw new Error(json.error.message ?? `JSON-RPC error code ${json.error.code}`);
      }
      return json.result;
    } catch (e: any) {
      clearTimeout(timer);
      if (e.name === 'AbortError') {
        throw new Error(`Timeout after ${timeoutMs}ms waiting for ${method}`);
      }
      throw e;
    }
  }

  /** Send JSON-RPC notification (fire-and-forget, no response expected). */
  sendNotification(method: string, params: any): void {
    const body = { jsonrpc: '2.0', method, params };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;
    fetch(this.url, { method: 'POST', headers, body: JSON.stringify(body) }).catch(() => {});
  }

  /** Parse SSE response — extract last data line containing JSON-RPC result. */
  private parseSSE(text: string): any {
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('data:')) {
        const dataStr = line.slice(5).trim();
        if (!dataStr) continue;
        const json = JSON.parse(dataStr);
        if (json.error) {
          throw new Error(json.error.message ?? `JSON-RPC error code ${json.error.code}`);
        }
        return json.result;
      }
    }
    throw new Error('No data in SSE response');
  }
}
