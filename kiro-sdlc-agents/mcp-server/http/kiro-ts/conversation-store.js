"use strict";
/**
 * Conversation Store — KSA-237
 * Per-session conversation history with tool_use_id tracking.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolIdMismatchError = exports.ConversationSession = exports.ConversationStore = void 0;
class ConversationStore {
    sessions = new Map();
    getOrCreate(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, new ConversationSession(sessionId));
        }
        return this.sessions.get(sessionId);
    }
    clear(sessionId) {
        this.sessions.delete(sessionId);
    }
}
exports.ConversationStore = ConversationStore;
class ConversationSession {
    sessionId;
    messages = [];
    toolUseIndex = new Map();
    turnCounter = 0;
    constructor(sessionId) {
        this.sessionId = sessionId;
    }
    addUserMessage(content) {
        this.turnCounter++;
        this.messages.push({ role: 'user', content });
    }
    addAssistantMessage(content) {
        this.turnCounter++;
        // Index tool_use blocks for later validation
        for (const block of content) {
            if (block.type === 'tool_use' && block.id) {
                this.toolUseIndex.set(block.id, {
                    id: block.id,
                    name: block.name || '',
                    input: block.input,
                });
            }
        }
        this.messages.push({ role: 'assistant', content });
    }
    addToolResult(toolUseId, content, isError) {
        // Validate tool_use_id exists in history (BR-16)
        if (!this.toolUseIndex.has(toolUseId)) {
            const available = this.getAllToolUseIds();
            throw new ToolIdMismatchError(toolUseId, available, this.turnCounter);
        }
        this.turnCounter++;
        this.messages.push({
            role: 'user',
            content: [{
                    type: 'tool_result',
                    tool_use_id: toolUseId,
                    content,
                    is_error: isError,
                }],
        });
    }
    findToolUse(toolUseId) {
        return this.toolUseIndex.get(toolUseId) ?? null;
    }
    getAllToolUseIds() {
        return Array.from(this.toolUseIndex.keys());
    }
    getMessages() {
        return [...this.messages];
    }
    getTurnCounter() {
        return this.turnCounter;
    }
    clearHistory() {
        this.messages = [];
        this.toolUseIndex.clear();
        this.turnCounter = 0;
    }
}
exports.ConversationSession = ConversationSession;
class ToolIdMismatchError extends Error {
    receivedId;
    availableIds;
    turnNumber;
    constructor(receivedId, availableIds, turnNumber) {
        super(`Tool continuation failed: tool_use_id '${receivedId}' not found in conversation history. ` +
            `Available IDs: [${availableIds.map(id => `'${id}'`).join(', ')}]`);
        this.name = 'ToolIdMismatchError';
        this.receivedId = receivedId;
        this.availableIds = availableIds;
        this.turnNumber = turnNumber;
    }
}
exports.ToolIdMismatchError = ToolIdMismatchError;
//# sourceMappingURL=conversation-store.js.map