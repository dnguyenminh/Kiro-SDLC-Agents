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

export class ConversationStore {
  private sessions: Map<string, ConversationSession> = new Map();

  getOrCreate(sessionId: string): ConversationSession {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new ConversationSession(sessionId));
    }
    return this.sessions.get(sessionId)!;
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

export class ConversationSession {
  public readonly sessionId: string;
  private messages: AnthropicMessage[] = [];
  private toolUseIndex: Map<string, ToolUseEntry> = new Map();
  private turnCounter = 0;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  addUserMessage(content: string | ContentBlock[]): void {
    this.turnCounter++;
    this.messages.push({ role: 'user', content });
  }

  addAssistantMessage(content: ContentBlock[]): void {
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

  addToolResult(toolUseId: string, content: string, isError: boolean): void {
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

  findToolUse(toolUseId: string): ToolUseEntry | null {
    return this.toolUseIndex.get(toolUseId) ?? null;
  }

  getAllToolUseIds(): string[] {
    return Array.from(this.toolUseIndex.keys());
  }

  getMessages(): AnthropicMessage[] {
    return [...this.messages];
  }

  getTurnCounter(): number {
    return this.turnCounter;
  }

  clearHistory(): void {
    this.messages = [];
    this.toolUseIndex.clear();
    this.turnCounter = 0;
  }
}

export class ToolIdMismatchError extends Error {
  public readonly receivedId: string;
  public readonly availableIds: string[];
  public readonly turnNumber: number;

  constructor(receivedId: string, availableIds: string[], turnNumber: number) {
    super(
      `Tool continuation failed: tool_use_id '${receivedId}' not found in conversation history. ` +
      `Available IDs: [${availableIds.map(id => `'${id}'`).join(', ')}]`
    );
    this.name = 'ToolIdMismatchError';
    this.receivedId = receivedId;
    this.availableIds = availableIds;
    this.turnNumber = turnNumber;
  }
}
