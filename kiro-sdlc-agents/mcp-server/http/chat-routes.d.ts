/**
 * Chat Completions Route — KSA-237
 * Handles POST /api/chat/completions on the MCP HTTP server.
 * Integrates kiro-ts Anthropic converter for ReAct tool loop.
 * Streams SSE responses back to the Chat Panel extension client.
 */
import * as http from 'http';
/**
 * Handle POST /api/chat/completions
 * Body: { messages, tools?, toolResult?, sessionId?, model?, apiKey?, baseUrl? }
 * Response: SSE stream (text/event-stream)
 */
export declare function handleChatRoute(req: http.IncomingMessage, res: http.ServerResponse): boolean;
//# sourceMappingURL=chat-routes.d.ts.map