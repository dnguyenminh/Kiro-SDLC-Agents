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
import { AnthropicRequest, ContentBlock } from './types.js';
import { validateRequest } from './request-validator.js';
import {
  resolveAuth,
  AuthenticationError,
  ensureFreshKiroToken,
  buildKiroAuthResult,
  RefreshTokenExpiredError,
} from './auth-resolver.js';
import { ConversationStore, ToolIdMismatchError } from './conversation-store.js';
import { selectAdapter } from './adapters/index.js';

const MAX_BODY_SIZE = 4 * 1024 * 1024; // 4MB

const conversationStore = new ConversationStore();

/**
 * Handle POST /v1/messages or POST /api/chat/completions.
 * Returns true if the request was handled, false if route didn't match.
 */
export function handleChatRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): boolean {
  if (req.method !== 'POST') return false;

  // Accept an optional `/anthropic` prefix so clients can be configured with a
  // base URL of `http://127.0.0.1:9181/anthropic` (the Anthropic SDK then
  // appends `/v1/messages`). Both prefixed and bare paths are supported.
  let url = req.url || '';
  if (url.startsWith('/anthropic/')) {
    url = url.slice('/anthropic'.length);
  } else if (url === '/anthropic') {
    url = '/v1/messages';
  }
  if (url !== '/v1/messages' && url !== '/api/chat/completions') return false;

  const apiKeyHeader = (req.headers['x-api-key'] as string) || '';
  let bodySize = 0;
  let body = '';

  req.on('data', (chunk: Buffer) => {
    bodySize += chunk.length;
    if (bodySize > MAX_BODY_SIZE) {
      sendError(res, 413, 'invalid_request_error', 'Request body too large (max 4MB)');
      req.destroy();
      return;
    }
    body += chunk.toString();
  });

  req.on('end', async () => {
    if (bodySize > MAX_BODY_SIZE) return; // Already responded with 413

    try {
      const data = JSON.parse(body);
      await processRequest(data, apiKeyHeader, res);
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        sendError(res, 400, 'invalid_request_error', `Invalid JSON: ${err.message}`);
      } else {
        sendError(res, 500, 'api_error', 'Internal server error');
      }
    }
  });

  return true;
}

async function processRequest(
  data: any,
  apiKeyHeader: string,
  res: http.ServerResponse,
): Promise<void> {
  // Step 1: Validate request body
  const validation = validateRequest(data);
  if (!validation.valid && validation.error) {
    const err = validation.error;
    sendError(res, 400, err.error.type, err.error.message);
    return;
  }

  const request = data as AnthropicRequest;
  const sessionId = request.sessionId || 'default';
  const stream = request.stream !== false; // Default true

  // Step 2: Handle tool result continuation
  const session = conversationStore.getOrCreate(sessionId);

  if (request.toolResult) {
    try {
      session.addToolResult(
        request.toolResult.toolUseId,
        request.toolResult.content,
        request.toolResult.isError ?? false,
      );
    } catch (err) {
      if (err instanceof ToolIdMismatchError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          type: 'error',
          error: {
            type: 'tool_use_id_mismatch',
            message: err.message,
            received_id: err.receivedId,
            available_ids: err.availableIds,
            turn_number: err.turnNumber,
          },
        }));
        return;
      }
      throw err;
    }
  }

  // Step 3: Add user message to history
  if (request.messages && request.messages.length > 0) {
    const lastMsg = request.messages[request.messages.length - 1];
    if (lastMsg.role === 'user') {
      session.addUserMessage(lastMsg.content);
    }
  }

  // Step 4: Resolve authentication
  let auth;
  try {
    auth = resolveAuth(apiKeyHeader);
  } catch (err) {
    if (err instanceof AuthenticationError) {
      sendError(res, 401, 'authentication_error', err.message);
      return;
    }
    throw err;
  }

  // Step 5: For Kiro mode, ensure the token is fresh before building the
  // upstream request so we never send a dead token.
  if (auth.mode === 'kiro') {
    try {
      const fresh = await ensureFreshKiroToken();
      if (fresh) {
        auth = buildKiroAuthResult(fresh);
      }
    } catch (err) {
      if (err instanceof RefreshTokenExpiredError) {
        sendError(res, 401, 'authentication_error',
          `Kiro session expired and could not be refreshed: ${err.message}`);
        return;
      }
      // Other refresh errors: log and continue with the existing token; the
      // upstream call will surface a 401/403 if it is truly invalid.
      console.error('[kiro-ts] Token refresh attempt failed:', (err as Error).message);
    }
  }

  // Step 6: Select the backend adapter and delegate the message creation.
  const adapter = selectAdapter(auth, {
    // Kiro adapter converts from full session history.
    messages: session.getMessages(),
    // Anthropic passthrough builds its upstream body from session history.
    buildBody: (req) => buildUpstreamBody(req, session),
    onComplete: (blocks: ContentBlock[]) => {
      if (blocks.length > 0) session.addAssistantMessage(blocks);
    },
  });

  await adapter.createMessage(request, res, stream);
}

function buildUpstreamBody(request: AnthropicRequest, session: any): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    max_tokens: request.max_tokens,
    messages: session.getMessages(),
    stream: request.stream !== false,
  };

  if (request.system) body.system = request.system;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.tools && request.tools.length > 0) body.tools = request.tools;
  if (request.tool_choice) body.tool_choice = request.tool_choice;
  if (request.stop_sequences && request.stop_sequences.length > 0) body.stop_sequences = request.stop_sequences;
  if (request.metadata) body.metadata = request.metadata;

  return body;
}

export function sendError(
  res: http.ServerResponse,
  statusCode: number,
  errorType: string,
  message: string,
): void {
  if (res.headersSent) return;
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    type: 'error',
    error: { type: errorType, message },
  }));
}
