import { KiroQResponse, ConversationMessage, ToolUseContentBlock } from '../anthropic/types';
/**
 * In-memory conversation history store.
 * Thread-safe for Node.js single-threaded event loop (no mutex needed).
 *
 * Uses Map<string, ToolUseContentBlock> for O(1) lookup on continuation (BR-2, BR-4).
 */
export declare class ConversationHistory {
    private messages;
    private toolUseIndex;
    private turnCounter;
    /**
     * Store assistant message, indexing all tool_use_ids for O(1) lookup.
     * CRITICAL (BR-2): IDs stored here MUST be the same as streamed to client.
     */
    addAssistantMessage(response: KiroQResponse): void;
    /**
     * Find a tool_use by ID. Returns null if not found (triggers UC-2).
     */
    findToolUse(toolUseId: string): ToolUseContentBlock | null;
    /**
     * Get all stored tool_use_ids for diagnostic output (BR-7).
     */
    getAllToolUseIds(): string[];
    /**
     * Store tool result, correlating with the original tool_use.
     */
    addToolResult(toolUseId: string, content: string, isError: boolean): void;
    getCurrentTurn(): number;
    getMessages(): ConversationMessage[];
    clear(): void;
}
