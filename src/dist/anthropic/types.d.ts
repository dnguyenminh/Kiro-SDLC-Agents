export interface KiroQResponse {
    id: string;
    type: "message";
    role: "assistant";
    content: KiroQContentBlock[];
    stop_reason: "tool_use" | "end_turn" | null;
}
export interface KiroQToolUseBlock {
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, unknown>;
}
export interface KiroQTextBlock {
    type: "text";
    text: string;
}
export type KiroQContentBlock = KiroQToolUseBlock | KiroQTextBlock;
export interface ContentBlockStartEvent {
    type: "content_block_start";
    index: number;
    content_block: {
        type: "tool_use" | "text";
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
    };
}
export interface ContentBlockDeltaEvent {
    type: "content_block_delta";
    index: number;
    delta: {
        type: "input_json_delta" | "text_delta";
        partial_json?: string;
        text?: string;
    };
}
export interface ContentBlockStopEvent {
    type: "content_block_stop";
    index: number;
}
export interface MessageStopEvent {
    type: "message_stop";
}
export type SSEEvent = ContentBlockStartEvent | ContentBlockDeltaEvent | ContentBlockStopEvent | MessageStopEvent;
export interface ConversationMessage {
    role: "user" | "assistant" | "tool_result";
    content: ContentBlock[];
    turnNumber: number;
}
export interface ToolUseContentBlock {
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, unknown>;
}
export interface ToolResultContentBlock {
    type: "tool_result";
    toolUseId: string;
    content: string;
    isError?: boolean;
}
export interface TextContentBlock {
    type: "text";
    text: string;
}
export type ContentBlock = ToolUseContentBlock | ToolResultContentBlock | TextContentBlock;
export interface ContinuationRequest {
    messages: Array<{
        role: string;
        content: string | ContentBlock[];
    }>;
    toolResult?: {
        toolUseId: string;
        content: string;
        isError?: boolean;
    };
}
export declare class ToolUseIdMismatchError extends Error {
    receivedId: string;
    availableIds: string[];
    turnNumber: number;
    constructor(receivedId: string, availableIds: string[], turnNumber: number);
}
export declare class MalformedApiResponseError extends Error {
    reason: string;
    constructor(reason: string);
}
//# sourceMappingURL=types.d.ts.map