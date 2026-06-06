/**
 * Conversation Store — KSA-237
 * Per-session conversation history with tool_use_id tracking.
 */
import { AnthropicMessage, ContentBlock } from './types.js';
interface ToolUseEntry {
    id: string;
    name: string;
    input: unknown;
}
export declare class ConversationStore {
    private sessions;
    getOrCreate(sessionId: string): ConversationSession;
    clear(sessionId: string): void;
}
export declare class ConversationSession {
    readonly sessionId: string;
    private messages;
    private toolUseIndex;
    private turnCounter;
    constructor(sessionId: string);
    addUserMessage(content: string | ContentBlock[]): void;
    addAssistantMessage(content: ContentBlock[]): void;
    addToolResult(toolUseId: string, content: string, isError: boolean): void;
    findToolUse(toolUseId: string): ToolUseEntry | null;
    getAllToolUseIds(): string[];
    getMessages(): AnthropicMessage[];
    getTurnCounter(): number;
    clearHistory(): void;
}
export declare class ToolIdMismatchError extends Error {
    readonly receivedId: string;
    readonly availableIds: string[];
    readonly turnNumber: number;
    constructor(receivedId: string, availableIds: string[], turnNumber: number);
}
export {};
//# sourceMappingURL=conversation-store.d.ts.map