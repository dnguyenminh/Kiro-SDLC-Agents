"use strict";
/**
 * Kiro Converter — KSA-237
 *
 * Converts an Anthropic Messages API request into the AWS CodeWhisperer
 * `conversationState` body expected by
 * `q.{region}.amazonaws.com/generateAssistantResponse`.
 *
 * Ported from kiro.rs `src/anthropic/converter.rs` and
 * `src/kiro/model/requests/conversation.rs` (only the subset needed:
 * text messages, system, tools, tool_results, model mapping, history pairing).
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
exports.ConversionError = void 0;
exports.mapModel = mapModel;
exports.convertRequest = convertRequest;
const crypto = __importStar(require("crypto"));
const ORIGIN = 'AI_EDITOR';
const AGENT_TASK_TYPE = 'vibe';
const CHAT_TRIGGER_TYPE = 'MANUAL'; // AUTO can trigger HTTP 400
const TOOL_NAME_MAX_LEN = 63;
// ---------------------------------------------------------------------------
// Model mapping (ported from map_model)
// ---------------------------------------------------------------------------
/**
 * Native Kiro model IDs that the CodeWhisperer backend accepts directly.
 * These come from the real `ListAvailableModels` response (see
 * kiro-models-client.ts) and are passed through unchanged. Includes the
 * task-router `auto` model and the non-Claude families (DeepSeek, MiniMax,
 * GLM, Qwen) that Kiro IDE now exposes.
 */
const NATIVE_KIRO_MODEL_IDS = new Set([
    'auto',
    'claude-opus-4.8',
    'claude-opus-4.7',
    'claude-opus-4.6',
    'claude-opus-4.5',
    'claude-sonnet-4.6',
    'claude-sonnet-4.5',
    'claude-sonnet-4',
    'claude-haiku-4.5',
    'deepseek-3.2',
    'minimax-m2.5',
    'minimax-m2.1',
    'glm-5',
    'qwen3-coder-next',
]);
/**
 * Map an Anthropic model name to a Kiro model ID.
 * Returns null when the model family is unrecognized.
 */
function mapModel(model) {
    const m = model.toLowerCase();
    // Pass through real Kiro model IDs unchanged (auto, deepseek, minimax,
    // glm, qwen, and the dotted claude ids) so models surfaced by the live
    // ListAvailableModels endpoint are accepted as-is by the chat backend.
    if (NATIVE_KIRO_MODEL_IDS.has(m))
        return m;
    if (m.includes('sonnet')) {
        if (m.includes('4-6') || m.includes('4.6'))
            return 'claude-sonnet-4.6';
        if (m.includes('4-5') || m.includes('4.5'))
            return 'claude-sonnet-4.5';
        // Default sonnet → latest known 4.5 (covers "claude-sonnet-4-20250514", "3-5-sonnet")
        return 'claude-sonnet-4.5';
    }
    if (m.includes('opus')) {
        if (m.includes('4-5') || m.includes('4.5'))
            return 'claude-opus-4.5';
        if (m.includes('4-6') || m.includes('4.6'))
            return 'claude-opus-4.6';
        if (m.includes('4-7') || m.includes('4.7'))
            return 'claude-opus-4.7';
        if (m.includes('4-8') || m.includes('4.8'))
            return 'claude-opus-4.8';
        return 'claude-opus-4.5';
    }
    if (m.includes('haiku')) {
        return 'claude-haiku-4.5';
    }
    // Other native families surfaced by ListAvailableModels (deepseek, minimax,
    // glm, qwen, ...) — pass through so newly-added Kiro models keep working
    // without a converter change. Note: gpt/llama are intentionally NOT here —
    // Kiro does not expose them, so they must remain unsupported (null).
    if (/^(deepseek|minimax|glm|qwen|kimi|grok)[-.\w]*$/.test(m)) {
        return m;
    }
    return null;
}
class ConversionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConversionError';
    }
}
exports.ConversionError = ConversionError;
// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------
function normalizeContent(content) {
    if (typeof content === 'string') {
        return [{ type: 'text', text: content }];
    }
    return content;
}
function getImageFormat(mediaType) {
    switch (mediaType) {
        case 'image/jpeg':
            return 'jpeg';
        case 'image/png':
            return 'png';
        case 'image/gif':
            return 'gif';
        case 'image/webp':
            return 'webp';
        default:
            return null;
    }
}
function extractToolResultContent(content) {
    if (typeof content === 'string')
        return content;
    if (Array.isArray(content)) {
        const parts = [];
        for (const item of content) {
            if (item && typeof item === 'object' && typeof item.text === 'string') {
                parts.push(item.text);
            }
        }
        return parts.join('\n');
    }
    if (content == null)
        return '';
    return typeof content === 'object' ? JSON.stringify(content) : String(content);
}
/** Process Anthropic message content into text, images and tool_results. */
function processMessageContent(content) {
    const blocks = normalizeContent(content);
    const textParts = [];
    const images = [];
    const toolResults = [];
    for (const block of blocks) {
        switch (block.type) {
            case 'text':
                if (block.text)
                    textParts.push(block.text);
                break;
            case 'image': {
                const source = block.source;
                if (source) {
                    const format = getImageFormat(source.media_type);
                    if (format && source.data) {
                        images.push({ format, source: { bytes: source.data } });
                    }
                }
                break;
            }
            case 'tool_result': {
                const toolUseId = block.tool_use_id;
                if (toolUseId) {
                    const text = extractToolResultContent(block.content);
                    const isError = block.is_error === true;
                    toolResults.push({
                        toolUseId,
                        content: [{ text }],
                        status: isError ? 'error' : 'success',
                    });
                }
                break;
            }
            default:
                // tool_use handled when converting assistant messages
                break;
        }
    }
    return { text: textParts.join('\n'), images, toolResults };
}
// ---------------------------------------------------------------------------
// Tool conversion
// ---------------------------------------------------------------------------
function shortenToolName(name) {
    const hashHex = crypto.createHash('sha256').update(name, 'utf8').digest('hex');
    const hashSuffix = hashHex.substring(0, 8);
    const prefixMax = TOOL_NAME_MAX_LEN - 1 - 8; // 54
    const prefix = name.substring(0, prefixMax);
    return `${prefix}_${hashSuffix}`;
}
function mapToolName(name, toolNameMap) {
    if (name.length <= TOOL_NAME_MAX_LEN)
        return name;
    const short = shortenToolName(name);
    toolNameMap[short] = name;
    return short;
}
function convertTools(tools, toolNameMap) {
    if (!tools || tools.length === 0)
        return [];
    return tools.map((t) => {
        let description = t.description || '';
        if (description.length > 10000)
            description = description.substring(0, 10000);
        return {
            toolSpecification: {
                name: mapToolName(t.name, toolNameMap),
                description,
                inputSchema: { json: t.input_schema || { type: 'object', properties: {} } },
            },
        };
    });
}
function createPlaceholderTool(name) {
    return {
        toolSpecification: {
            name,
            description: 'Tool used in conversation history',
            inputSchema: {
                json: {
                    $schema: 'http://json-schema.org/draft-07/schema#',
                    type: 'object',
                    properties: {},
                    required: [],
                    additionalProperties: true,
                },
            },
        },
    };
}
function convertAssistantMessage(msg, toolNameMap) {
    const blocks = normalizeContent(msg.content);
    let thinkingContent = '';
    let textContent = '';
    const toolUses = [];
    for (const block of blocks) {
        switch (block.type) {
            case 'thinking':
                if (block.thinking)
                    thinkingContent += block.thinking;
                break;
            case 'text':
                if (block.text)
                    textContent += block.text;
                break;
            case 'tool_use': {
                if (block.id && block.name) {
                    toolUses.push({
                        toolUseId: block.id,
                        name: mapToolName(block.name, toolNameMap),
                        input: block.input ?? {},
                    });
                }
                break;
            }
            default:
                break;
        }
    }
    let finalContent;
    if (thinkingContent) {
        finalContent = textContent
            ? `<thinking>${thinkingContent}</thinking>\n\n${textContent}`
            : `<thinking>${thinkingContent}</thinking>`;
    }
    else if (!textContent && toolUses.length > 0) {
        // Kiro requires non-empty content when only tool_use is present
        finalContent = ' ';
    }
    else {
        finalContent = textContent;
    }
    return { content: finalContent, toolUses };
}
function mergeUserMessages(msgs, modelId) {
    const contentParts = [];
    const allImages = [];
    const allToolResults = [];
    for (const msg of msgs) {
        const { text, images, toolResults } = processMessageContent(msg.content);
        if (text)
            contentParts.push(text);
        allImages.push(...images);
        allToolResults.push(...toolResults);
    }
    const userInputMessage = {
        content: contentParts.join('\n'),
        modelId,
        origin: ORIGIN,
    };
    if (allImages.length > 0)
        userInputMessage.images = allImages;
    if (allToolResults.length > 0) {
        userInputMessage.userInputMessageContext = { toolResults: allToolResults };
    }
    return { userInputMessage };
}
function mergeAssistantMessages(msgs, toolNameMap) {
    const allToolUses = [];
    const contentParts = [];
    for (const msg of msgs) {
        const converted = convertAssistantMessage(msg, toolNameMap);
        if (converted.content.trim())
            contentParts.push(converted.content);
        allToolUses.push(...converted.toolUses);
    }
    const content = contentParts.length === 0 && allToolUses.length > 0 ? ' ' : contentParts.join('\n\n');
    const assistantResponseMessage = { content };
    if (allToolUses.length > 0)
        assistantResponseMessage.toolUses = allToolUses;
    return { assistantResponseMessage };
}
// ---------------------------------------------------------------------------
// History construction
// ---------------------------------------------------------------------------
function buildHistory(req, messages, modelId, toolNameMap) {
    const history = [];
    // 1. System message → User(policy) / Assistant("I will follow these instructions.")
    if (req.system && req.system.trim().length > 0) {
        history.push({
            userInputMessage: { content: req.system, modelId, origin: ORIGIN },
        });
        history.push({
            assistantResponseMessage: { content: 'I will follow these instructions.' },
        });
    }
    // 2. Regular history (everything except the last message, which is currentMessage)
    const historyEnd = Math.max(0, messages.length - 1);
    let userBuffer = [];
    let assistantBuffer = [];
    for (let i = 0; i < historyEnd; i++) {
        const msg = messages[i];
        if (msg.role === 'user') {
            if (assistantBuffer.length > 0) {
                history.push(mergeAssistantMessages(assistantBuffer, toolNameMap));
                assistantBuffer = [];
            }
            userBuffer.push(msg);
        }
        else if (msg.role === 'assistant') {
            if (userBuffer.length > 0) {
                history.push(mergeUserMessages(userBuffer, modelId));
                userBuffer = [];
            }
            assistantBuffer.push(msg);
        }
    }
    if (assistantBuffer.length > 0) {
        history.push(mergeAssistantMessages(assistantBuffer, toolNameMap));
    }
    if (userBuffer.length > 0) {
        history.push(mergeUserMessages(userBuffer, modelId));
        // Auto-pair with an "OK" assistant response
        history.push({ assistantResponseMessage: { content: 'OK' } });
    }
    return history;
}
// ---------------------------------------------------------------------------
// Tool pairing helpers
// ---------------------------------------------------------------------------
function collectHistoryToolNames(history) {
    const names = [];
    for (const msg of history) {
        if ('assistantResponseMessage' in msg && msg.assistantResponseMessage.toolUses) {
            for (const tu of msg.assistantResponseMessage.toolUses) {
                if (!names.includes(tu.name))
                    names.push(tu.name);
            }
        }
    }
    return names;
}
function collectHistoryToolUseIds(history) {
    const ids = new Set();
    for (const msg of history) {
        if ('assistantResponseMessage' in msg && msg.assistantResponseMessage.toolUses) {
            for (const tu of msg.assistantResponseMessage.toolUses)
                ids.add(tu.toolUseId);
        }
    }
    return ids;
}
function collectHistoryToolResultIds(history) {
    const ids = new Set();
    for (const msg of history) {
        if ('userInputMessage' in msg && msg.userInputMessage.userInputMessageContext?.toolResults) {
            for (const tr of msg.userInputMessage.userInputMessageContext.toolResults)
                ids.add(tr.toolUseId);
        }
    }
    return ids;
}
/**
 * Validate tool_use/tool_result pairing.
 * Filters current-message tool_results to only those with an unpaired tool_use in history,
 * and returns orphaned tool_use ids to strip from history.
 */
function validateToolPairing(history, toolResults) {
    const allToolUseIds = collectHistoryToolUseIds(history);
    const historyResultIds = collectHistoryToolResultIds(history);
    const unpaired = new Set();
    for (const id of allToolUseIds) {
        if (!historyResultIds.has(id))
            unpaired.add(id);
    }
    const filtered = [];
    for (const result of toolResults) {
        if (unpaired.has(result.toolUseId)) {
            filtered.push(result);
            unpaired.delete(result.toolUseId);
        }
        // else: duplicate or orphaned tool_result — skip silently
    }
    return { filtered, orphanedToolUseIds: unpaired };
}
function removeOrphanedToolUses(history, orphaned) {
    if (orphaned.size === 0)
        return;
    for (const msg of history) {
        if ('assistantResponseMessage' in msg && msg.assistantResponseMessage.toolUses) {
            const kept = msg.assistantResponseMessage.toolUses.filter((tu) => !orphaned.has(tu.toolUseId));
            msg.assistantResponseMessage.toolUses = kept.length > 0 ? kept : undefined;
        }
    }
}
// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------
/**
 * Convert an Anthropic Messages request into a Kiro conversationState body.
 */
function convertRequest(req) {
    const modelId = mapModel(req.model);
    if (!modelId) {
        throw new ConversionError(`Unsupported model: ${req.model}`);
    }
    if (!req.messages || req.messages.length === 0) {
        throw new ConversionError('messages list is empty');
    }
    // Prefill handling: if the last message is an assistant prefill, truncate to last user.
    let messages = req.messages;
    const last = messages[messages.length - 1];
    if (last.role !== 'user') {
        const lastUserIdx = findLastIndex(messages, (m) => m.role === 'user');
        if (lastUserIdx < 0)
            throw new ConversionError('messages list has no user message');
        messages = messages.slice(0, lastUserIdx + 1);
    }
    const conversationId = crypto.randomUUID();
    const agentContinuationId = crypto.randomUUID();
    // Current message = last message
    const lastMessage = messages[messages.length - 1];
    const { text, images, toolResults } = processMessageContent(lastMessage.content);
    const toolNameMap = {};
    const tools = convertTools(req.tools, toolNameMap);
    // History (everything but the last message)
    const history = buildHistory(req, messages, modelId, toolNameMap);
    // Validate tool pairing and strip orphaned tool_use blocks
    const { filtered: validatedToolResults, orphanedToolUseIds } = validateToolPairing(history, toolResults);
    removeOrphanedToolUses(history, orphanedToolUseIds);
    // Ensure history-referenced tools have definitions (placeholders)
    const historyToolNames = collectHistoryToolNames(history);
    const existing = new Set(tools.map((t) => t.toolSpecification.name.toLowerCase()));
    for (const name of historyToolNames) {
        if (!existing.has(name.toLowerCase())) {
            tools.push(createPlaceholderTool(name));
            existing.add(name.toLowerCase());
        }
    }
    const context = {};
    if (tools.length > 0)
        context.tools = tools;
    if (validatedToolResults.length > 0)
        context.toolResults = validatedToolResults;
    const currentMessage = {
        userInputMessage: {
            content: text,
            modelId,
            origin: ORIGIN,
            userInputMessageContext: context,
        },
    };
    if (images.length > 0)
        currentMessage.userInputMessage.images = images;
    const conversationState = {
        conversationId,
        agentContinuationId,
        agentTaskType: AGENT_TASK_TYPE,
        chatTriggerType: CHAT_TRIGGER_TYPE,
        currentMessage,
        history,
    };
    return { conversationState, toolNameMap };
}
function findLastIndex(arr, pred) {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (pred(arr[i]))
            return i;
    }
    return -1;
}
//# sourceMappingURL=kiro-converter.js.map