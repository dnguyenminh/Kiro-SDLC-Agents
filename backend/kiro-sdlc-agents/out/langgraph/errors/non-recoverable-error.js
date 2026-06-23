"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NonRecoverableError = void 0;
/**
 * NonRecoverableError — KSA-233
 * Thrown when an error should NOT be retried (missing config, invalid state).
 * BaseNode.run() checks instanceof to skip retry logic.
 */
class NonRecoverableError extends Error {
    code;
    recoverable = false;
    constructor(message, code = "NON_RECOVERABLE") {
        super(message);
        this.code = code;
        this.name = "NonRecoverableError";
    }
}
exports.NonRecoverableError = NonRecoverableError;
//# sourceMappingURL=non-recoverable-error.js.map