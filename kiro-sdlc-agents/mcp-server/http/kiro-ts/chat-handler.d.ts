/**
 * Chat Handler — KSA-237 (Adapter Pattern)
 * Main request handler for POST /v1/messages and POST /api/chat/completions.
 * Implements the full Anthropic Messages API proxy.
 *
 * Backend selection is delegated to the Adapter pattern (adapters/). This
 * handler owns request lifecycle concerns only: path matching, body parsing,
 * validation, ConversationStore session handling, auth resolution, and Kiro
 * token freshness. The actual upstream call is performed by the selected
 * LLMBackendAdapter.
 */
import * as http from 'http';
/**
 * Handle POST /v1/messages or POST /api/chat/completions.
 * Returns true if the request was handled, false if route didn't match.
 */
export declare function handleChatRoute(req: http.IncomingMessage, res: http.ServerResponse): boolean;
export declare function sendError(res: http.ServerResponse, statusCode: number, errorType: string, message: string): void;
//# sourceMappingURL=chat-handler.d.ts.map