// --- Kiro Q API Response Types ---
// --- Error Types ---
export class ToolUseIdMismatchError extends Error {
    receivedId;
    availableIds;
    turnNumber;
    constructor(receivedId, availableIds, turnNumber) {
        super(`tool_use_id '${receivedId}' not found in history`);
        this.receivedId = receivedId;
        this.availableIds = availableIds;
        this.turnNumber = turnNumber;
        this.name = 'ToolUseIdMismatchError';
    }
}
export class MalformedApiResponseError extends Error {
    reason;
    constructor(reason) {
        super(`Malformed API response: ${reason}`);
        this.reason = reason;
        this.name = 'MalformedApiResponseError';
    }
}
//# sourceMappingURL=types.js.map