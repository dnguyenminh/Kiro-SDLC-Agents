"use strict";
// --- Kiro Q API Response Types ---
Object.defineProperty(exports, "__esModule", { value: true });
exports.MalformedApiResponseError = exports.ToolUseIdMismatchError = void 0;
// --- Error Types ---
class ToolUseIdMismatchError extends Error {
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
exports.ToolUseIdMismatchError = ToolUseIdMismatchError;
class MalformedApiResponseError extends Error {
    reason;
    constructor(reason) {
        super(`Malformed API response: ${reason}`);
        this.reason = reason;
        this.name = 'MalformedApiResponseError';
    }
}
exports.MalformedApiResponseError = MalformedApiResponseError;
//# sourceMappingURL=types.js.map