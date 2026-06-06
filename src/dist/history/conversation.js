"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationHistory = void 0;
/**
 * In-memory conversation history store.
 * Thread-safe for Node.js single-threaded event loop (no mutex needed).
 *
 * Uses Map<string, ToolUseContentBlock> for O(1) lookup on continuation (BR-2, BR-4).
 */
class ConversationHistory {
    messages = [];
    toolUseIndex = new Map();
    turnCounter = 0;
    /**
     * Store assistant message, indexing all tool_use_ids for O(1) lookup.
     * CRITICAL (BR-2): IDs stored here MUST be the same as streamed to client.
     */
    addAssistantMessage(response) {
        this.turnCounter++;
        const blocks = response.content.map(block => {
            if (block.type === 'tool_use') {
                const toolBlock = {
                    type: 'tool_use',
                    id: block.id, // SAME id from API (BR-1, BR-2)
                    name: block.name,
                    input: block.input,
                };
                // Index for fast lookup on continuation
                this.toolUseIndex.set(block.id, toolBlock);
                return toolBlock;
            }
            return { type: 'text', text: block.text };
        });
        this.messages.push({
            role: 'assistant',
            content: blocks,
            turnNumber: this.turnCounter,
        });
    }
    /**
     * Find a tool_use by ID. Returns null if not found (triggers UC-2).
     */
    findToolUse(toolUseId) {
        return this.toolUseIndex.get(toolUseId) ?? null;
    }
    /**
     * Get all stored tool_use_ids for diagnostic output (BR-7).
     */
    getAllToolUseIds() {
        return Array.from(this.toolUseIndex.keys());
    }
    /**
     * Store tool result, correlating with the original tool_use.
     */
    addToolResult(toolUseId, content, isError) {
        this.turnCounter++;
        this.messages.push({
            role: 'tool_result',
            content: [{
                    type: 'tool_result',
                    toolUseId,
                    content,
                    isError,
                }],
            turnNumber: this.turnCounter,
        });
    }
    getCurrentTurn() {
        return this.turnCounter;
    }
    getMessages() {
        return [...this.messages];
    }
    clear() {
        this.messages = [];
        this.toolUseIndex.clear();
        this.turnCounter = 0;
    }
}
exports.ConversationHistory = ConversationHistory;
//# sourceMappingURL=conversation.js.map