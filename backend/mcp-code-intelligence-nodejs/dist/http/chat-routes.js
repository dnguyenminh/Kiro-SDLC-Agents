"use strict";
/**
 * Chat Completions Route — KSA-237
 * Handles POST /api/chat/completions on the MCP HTTP server.
 * Integrates kiro-ts Anthropic converter for ReAct tool loop.
 * Streams SSE responses back to the Chat Panel extension client.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChatRoute = handleChatRoute;
class ChatConversationHistory {
    toolUseIndex = new Map();
    messages = [];
    turnCounter = 0;
    addAssistantMessage(content) {
        this.turnCounter++;
        for (const block of content) {
            if (block.type === 'tool_use' && block.id) {
                this.toolUseIndex.set(block.id, { id: block.id, name: block.name, input: block.input });
            }
        }
        this.messages.push({ role: 'assistant', content });
    }
    addUserMessage(content) {
        this.turnCounter++;
        this.messages.push({ role: 'user', content });
    }
    addToolResult(toolUseId, content, isError) {
        this.turnCounter++;
        this.messages.push({
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: toolUseId, content, is_error: isError }],
        });
    }
    findToolUse(toolUseId) {
        return this.toolUseIndex.get(toolUseId) ?? null;
    }
    getAllToolUseIds() {
        return Array.from(this.toolUseIndex.keys());
    }
    getCurrentTurn() {
        return this.turnCounter;
    }
    getMessages() {
        return this.messages;
    }
    clear() {
        this.messages = [];
        this.toolUseIndex.clear();
        this.turnCounter = 0;
    }
}
/** Per-session conversation histories */
const sessions = new Map();
function getOrCreateSession(sessionId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, new ChatConversationHistory());
    }
    return sessions.get(sessionId);
}
/**
 * Handle POST /api/chat/completions
 * Body: { messages, tools?, toolResult?, sessionId?, model?, apiKey?, baseUrl? }
 * Response: SSE stream (text/event-stream)
 */
function handleChatRoute(req, res) {
    if (req.method !== 'POST')
        return false;
    // Read API key from request header (extension sends x-api-key header)
    const headerApiKey = req.headers['x-api-key'] || '';
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
        try {
            const data = JSON.parse(body);
            data._headerApiKey = headerApiKey;
            await processChatRequest(data, res);
        }
        catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { type: 'parse_error', message: err.message } }));
        }
    });
    return true;
}
async function processChatRequest(data, res) {
    const { messages = [], tools = [], toolResult, sessionId = 'default', model = 'claude-sonnet-4-20250514', baseUrl, } = data;
    // API key from header (extension sends x-api-key) or body fallback
    const apiKey = data._headerApiKey || data.apiKey || data.api_key || '';
    const history = getOrCreateSession(sessionId);
    // Step 1: Handle tool result continuation (BR-2)
    if (toolResult) {
        const { toolUseId, content, isError } = toolResult;
        const match = history.findToolUse(toolUseId);
        if (!match) {
            const availableIds = history.getAllToolUseIds();
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: {
                    type: 'tool_use_id_mismatch',
                    message: `Tool continuation failed: tool_use_id '${toolUseId}' not found in conversation history. Available IDs: [${availableIds.map((id) => `'${id}'`).join(', ')}]`,
                    received_id: toolUseId,
                    available_ids: availableIds,
                    turn_number: history.getCurrentTurn(),
                },
            }));
            return;
        }
        history.addToolResult(toolUseId, content, isError ?? false);
    }
    // Step 2: Add user message to history
    if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'user' && typeof lastMsg.content === 'string') {
            history.addUserMessage(lastMsg.content);
        }
    }
    // Step 3: Validate API key
    if (!apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'auth_error', message: 'API key required. Set it in SDLC Pipeline Settings.' } }));
        return;
    }
    try {
        const anthropicUrl = baseUrl || 'https://api.anthropic.com';
        const apiMessages = history.getMessages();
        const requestBody = {
            model,
            max_tokens: 4096,
            messages: apiMessages,
        };
        if (tools.length > 0) {
            requestBody.tools = tools.map((t) => ({
                name: t.name,
                description: t.description || '',
                input_schema: t.inputSchema || t.input_schema || { type: 'object', properties: {} },
            }));
        }
        // Call Anthropic Messages API
        const response = await fetch(`${anthropicUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            const errText = await response.text();
            res.writeHead(response.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { type: 'api_error', message: errText } }));
            return;
        }
        const apiResponse = await response.json();
        // Step 4: Store in history with SAME IDs (BR-2)
        history.addAssistantMessage(apiResponse.content);
        // Step 5: Stream SSE response (BR-1 — ID passthrough)
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });
        for (let i = 0; i < apiResponse.content.length; i++) {
            const block = apiResponse.content[i];
            if (block.type === 'tool_use') {
                // BR-1: Passthrough block.id directly
                res.write(`event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} } })}\n\n`);
                res.write(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } })}\n\n`);
                res.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: i })}\n\n`);
            }
            else if (block.type === 'text') {
                res.write(`event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: i, content_block: { type: 'text' } })}\n\n`);
                res.write(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: block.text } })}\n\n`);
                res.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: i })}\n\n`);
            }
        }
        res.write(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop', stop_reason: apiResponse.stop_reason })}\n\n`);
        res.end();
    }
    catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'upstream_error', message: err.message || 'Failed to connect to AI service' } }));
    }
}
//# sourceMappingURL=chat-routes.js.map