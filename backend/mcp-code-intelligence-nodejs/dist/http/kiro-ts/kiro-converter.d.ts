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
import { AnthropicRequest } from './types.js';
/**
 * Map an Anthropic model name to a Kiro model ID.
 * Returns null when the model family is unrecognized.
 */
export declare function mapModel(model: string): string | null;
export interface KiroToolSpecification {
    name: string;
    description: string;
    inputSchema: {
        json: unknown;
    };
}
export interface KiroTool {
    toolSpecification: KiroToolSpecification;
}
export interface KiroToolResult {
    toolUseId: string;
    content: Array<{
        text: string;
    }>;
    status: 'success' | 'error';
}
export interface KiroToolUseEntry {
    toolUseId: string;
    name: string;
    input: unknown;
}
export interface KiroImage {
    format: string;
    source: {
        bytes: string;
    };
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
export type HistoryMessage = {
    userInputMessage: {
        content: string;
        modelId: string;
        origin: string;
        userInputMessageContext?: UserInputMessageContext;
        images?: KiroImage[];
    };
} | {
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
export declare class ConversionError extends Error {
    constructor(message: string);
}
/**
 * Convert an Anthropic Messages request into a Kiro conversationState body.
 */
export declare function convertRequest(req: AnthropicRequest): ConversionResult;
//# sourceMappingURL=kiro-converter.d.ts.map