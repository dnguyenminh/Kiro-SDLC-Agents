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

import * as crypto from 'crypto';
import { AnthropicRequest, AnthropicMessage, ContentBlock } from './types.js';

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
const NATIVE_KIRO_MODEL_IDS = new Set<string>([
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
export function mapModel(model: string): string | null {
  const m = model.toLowerCase();

  // Pass through real Kiro model IDs unchanged (auto, deepseek, minimax,
  // glm, qwen, and the dotted claude ids) so models surfaced by the live
  // ListAvailableModels endpoint are accepted as-is by the chat backend.
  if (NATIVE_KIRO_MODEL_IDS.has(m)) return m;

  if (m.includes('sonnet')) {
    if (m.includes('4-6') || m.includes('4.6')) return 'claude-sonnet-4.6';
    if (m.includes('4-5') || m.includes('4.5')) return 'claude-sonnet-4.5';
    // Default sonnet → latest known 4.5 (covers "claude-sonnet-4-20250514", "3-5-sonnet")
    return 'claude-sonnet-4.5';
  }
  if (m.includes('opus')) {
    if (m.includes('4-5') || m.includes('4.5')) return 'claude-opus-4.5';
    if (m.includes('4-6') || m.includes('4.6')) return 'claude-opus-4.6';
    if (m.includes('4-7') || m.includes('4.7')) return 'claude-opus-4.7';
    if (m.includes('4-8') || m.includes('4.8')) return 'claude-opus-4.8';
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

// ---------------------------------------------------------------------------
// Types for the converted conversationState
// ---------------------------------------------------------------------------

export interface KiroToolSpecification {
  name: string;
  description: string;
  inputSchema: { json: unknown };
}

export interface KiroTool {
  toolSpecification: KiroToolSpecification;
}

export interface KiroToolResult {
  toolUseId: string;
  content: Array<{ text: string }>;
  status: 'success' | 'error';
}

export interface KiroToolUseEntry {
  toolUseId: string;
  name: string;
  input: unknown;
}

export interface KiroImage {
  format: string;
  source: { bytes: string };
}

export interface UserInputMessageContext {
  tools?: KiroTool[];
  toolResults?: KiroToolResult[];
}

export interface CurrentMessage {
  userInputMessage: {
    content: string;
    modelId: string;
    origin: string;
    userInputMessageContext: UserInputMessageContext;
    images?: KiroImage[];
  };
}

export type HistoryMessage =
  | {
      userInputMessage: {
        content: string;
        modelId: string;
        origin: string;
        userInputMessageContext?: UserInputMessageContext;
        images?: KiroImage[];
      };
    }
  | {
      assistantResponseMessage: {
        content: string;
        toolUses?: KiroToolUseEntry[];
      };
    };

export interface ConversationState {
  conversationId: string;
  agentContinuationId: string;
  agentTaskType: string;
  chatTriggerType: string;
  currentMessage: CurrentMessage;
  history: HistoryMessage[];
}

export interface ConversionResult {
  conversationState: ConversationState;
  toolNameMap: Record<string, string>;
}

export class ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversionError';
  }
}

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

function normalizeContent(content: string | ContentBlock[]): ContentBlock[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }
  return content;
}

interface ProcessedContent {
  text: string;
  images: KiroImage[];
  toolResults: KiroToolResult[];
}

function getImageFormat(mediaType: string | undefined): string | null {
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

function extractToolResultContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (item && typeof item === 'object' && typeof (item as any).text === 'string') {
        parts.push((item as any).text);
      }
    }
    return parts.join('\n');
  }
  if (content == null) return '';
  return typeof content === 'object' ? JSON.stringify(content) : String(content);
}

/** Process Anthropic message content into text, images and tool_results. */
function processMessageContent(content: string | ContentBlock[]): ProcessedContent {
  const blocks = normalizeContent(content);
  const textParts: string[] = [];
  const images: KiroImage[] = [];
  const toolResults: KiroToolResult[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        if (block.text) textParts.push(block.text);
        break;
      case 'image': {
        const source = (block as any).source;
        if (source) {
          const format = getImageFormat(source.media_type);
          if (format && source.data) {
            images.push({ format, source: { bytes: source.data } });
          }
        }
        break;
      }
      case 'tool_result': {
        const toolUseId = (block as any).tool_use_id;
        if (toolUseId) {
          const text = extractToolResultContent((block as any).content);
          const isError = (block as any).is_error === true;
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

function shortenToolName(name: string): string {
  const hashHex = crypto.createHash('sha256').update(name, 'utf8').digest('hex');
  const hashSuffix = hashHex.substring(0, 8);
  const prefixMax = TOOL_NAME_MAX_LEN - 1 - 8; // 54
  const prefix = name.substring(0, prefixMax);
  return `${prefix}_${hashSuffix}`;
}

function mapToolName(name: string, toolNameMap: Record<string, string>): string {
  if (name.length <= TOOL_NAME_MAX_LEN) return name;
  const short = shortenToolName(name);
  toolNameMap[short] = name;
  return short;
}

function convertTools(
  tools: AnthropicRequest['tools'],
  toolNameMap: Record<string, string>,
): KiroTool[] {
  if (!tools || tools.length === 0) return [];
  return tools.map((t) => {
    let description = t.description || '';
    if (description.length > 10000) description = description.substring(0, 10000);
    return {
      toolSpecification: {
        name: mapToolName(t.name, toolNameMap),
        description,
        inputSchema: { json: t.input_schema || { type: 'object', properties: {} } },
      },
    };
  });
}

function createPlaceholderTool(name: string): KiroTool {
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

// ---------------------------------------------------------------------------
// Assistant message conversion
// ---------------------------------------------------------------------------

interface ConvertedAssistant {
  content: string;
  toolUses: KiroToolUseEntry[];
}

function convertAssistantMessage(
  msg: AnthropicMessage,
  toolNameMap: Record<string, string>,
): ConvertedAssistant {
  const blocks = normalizeContent(msg.content);
  let thinkingContent = '';
  let textContent = '';
  const toolUses: KiroToolUseEntry[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'thinking':
        if ((block as any).thinking) thinkingContent += (block as any).thinking;
        break;
      case 'text':
        if (block.text) textContent += block.text;
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

  let finalContent: string;
  if (thinkingContent) {
    finalContent = textContent
      ? `<thinking>${thinkingContent}</thinking>\n\n${textContent}`
      : `<thinking>${thinkingContent}</thinking>`;
  } else if (!textContent && toolUses.length > 0) {
    // Kiro requires non-empty content when only tool_use is present
    finalContent = ' ';
  } else {
    finalContent = textContent;
  }

  return { content: finalContent, toolUses };
}

function mergeUserMessages(msgs: AnthropicMessage[], modelId: string): HistoryMessage {
  const contentParts: string[] = [];
  const allImages: KiroImage[] = [];
  const allToolResults: KiroToolResult[] = [];

  for (const msg of msgs) {
    const { text, images, toolResults } = processMessageContent(msg.content);
    if (text) contentParts.push(text);
    allImages.push(...images);
    allToolResults.push(...toolResults);
  }

  const userInputMessage: any = {
    content: contentParts.join('\n'),
    modelId,
    origin: ORIGIN,
  };
  if (allImages.length > 0) userInputMessage.images = allImages;
  if (allToolResults.length > 0) {
    userInputMessage.userInputMessageContext = { toolResults: allToolResults };
  }

  return { userInputMessage };
}

function mergeAssistantMessages(
  msgs: AnthropicMessage[],
  toolNameMap: Record<string, string>,
): HistoryMessage {
  const allToolUses: KiroToolUseEntry[] = [];
  const contentParts: string[] = [];

  for (const msg of msgs) {
    const converted = convertAssistantMessage(msg, toolNameMap);
    if (converted.content.trim()) contentParts.push(converted.content);
    allToolUses.push(...converted.toolUses);
  }

  const content = contentParts.length === 0 && allToolUses.length > 0 ? ' ' : contentParts.join('\n\n');
  const assistantResponseMessage: any = { content };
  if (allToolUses.length > 0) assistantResponseMessage.toolUses = allToolUses;

  return { assistantResponseMessage };
}

// ---------------------------------------------------------------------------
// History construction
// ---------------------------------------------------------------------------

function buildHistory(
  req: AnthropicRequest,
  messages: AnthropicMessage[],
  modelId: string,
  toolNameMap: Record<string, string>,
): HistoryMessage[] {
  const history: HistoryMessage[] = [];

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
  let userBuffer: AnthropicMessage[] = [];
  let assistantBuffer: AnthropicMessage[] = [];

  for (let i = 0; i < historyEnd; i++) {
    const msg = messages[i];
    if (msg.role === 'user') {
      if (assistantBuffer.length > 0) {
        history.push(mergeAssistantMessages(assistantBuffer, toolNameMap));
        assistantBuffer = [];
      }
      userBuffer.push(msg);
    } else if (msg.role === 'assistant') {
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

function collectHistoryToolNames(history: HistoryMessage[]): string[] {
  const names: string[] = [];
  for (const msg of history) {
    if ('assistantResponseMessage' in msg && msg.assistantResponseMessage.toolUses) {
      for (const tu of msg.assistantResponseMessage.toolUses) {
        if (!names.includes(tu.name)) names.push(tu.name);
      }
    }
  }
  return names;
}

function collectHistoryToolUseIds(history: HistoryMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const msg of history) {
    if ('assistantResponseMessage' in msg && msg.assistantResponseMessage.toolUses) {
      for (const tu of msg.assistantResponseMessage.toolUses) ids.add(tu.toolUseId);
    }
  }
  return ids;
}

function collectHistoryToolResultIds(history: HistoryMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const msg of history) {
    if ('userInputMessage' in msg && msg.userInputMessage.userInputMessageContext?.toolResults) {
      for (const tr of msg.userInputMessage.userInputMessageContext.toolResults) ids.add(tr.toolUseId);
    }
  }
  return ids;
}

/**
 * Validate tool_use/tool_result pairing.
 * Filters current-message tool_results to only those with an unpaired tool_use in history,
 * and returns orphaned tool_use ids to strip from history.
 */
function validateToolPairing(
  history: HistoryMessage[],
  toolResults: KiroToolResult[],
): { filtered: KiroToolResult[]; orphanedToolUseIds: Set<string> } {
  const allToolUseIds = collectHistoryToolUseIds(history);
  const historyResultIds = collectHistoryToolResultIds(history);

  const unpaired = new Set<string>();
  for (const id of allToolUseIds) {
    if (!historyResultIds.has(id)) unpaired.add(id);
  }

  const filtered: KiroToolResult[] = [];
  for (const result of toolResults) {
    if (unpaired.has(result.toolUseId)) {
      filtered.push(result);
      unpaired.delete(result.toolUseId);
    }
    // else: duplicate or orphaned tool_result — skip silently
  }

  return { filtered, orphanedToolUseIds: unpaired };
}

function removeOrphanedToolUses(history: HistoryMessage[], orphaned: Set<string>): void {
  if (orphaned.size === 0) return;
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
export function convertRequest(req: AnthropicRequest): ConversionResult {
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
    if (lastUserIdx < 0) throw new ConversionError('messages list has no user message');
    messages = messages.slice(0, lastUserIdx + 1);
  }

  const conversationId = crypto.randomUUID();
  const agentContinuationId = crypto.randomUUID();

  // Current message = last message
  const lastMessage = messages[messages.length - 1];
  const { text, images, toolResults } = processMessageContent(lastMessage.content);

  const toolNameMap: Record<string, string> = {};
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

  const context: UserInputMessageContext = {};
  if (tools.length > 0) context.tools = tools;
  if (validatedToolResults.length > 0) context.toolResults = validatedToolResults;

  const currentMessage: CurrentMessage = {
    userInputMessage: {
      content: text,
      modelId,
      origin: ORIGIN,
      userInputMessageContext: context,
    },
  };
  if (images.length > 0) currentMessage.userInputMessage.images = images;

  const conversationState: ConversationState = {
    conversationId,
    agentContinuationId,
    agentTaskType: AGENT_TASK_TYPE,
    chatTriggerType: CHAT_TRIGGER_TYPE,
    currentMessage,
    history,
  };

  return { conversationState, toolNameMap };
}

function findLastIndex<T>(arr: T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}
