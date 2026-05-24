"use strict";
/**
 * ErrorClassifier — classify tool execution errors as permanent vs transient.
 * KSA-139: Determines whether cache should be invalidated.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorClass = void 0;
exports.classifyError = classifyError;
var ErrorClass;
(function (ErrorClass) {
    ErrorClass["PERMANENT"] = "permanent";
    ErrorClass["TRANSIENT"] = "transient";
    ErrorClass["SERVER_DISCONNECT"] = "server_disconnect";
})(ErrorClass || (exports.ErrorClass = ErrorClass = {}));
/** Patterns indicating permanent errors (tool is gone/broken). */
const PERMANENT_PATTERNS = [
    /tool not found/i,
    /unknown tool/i,
    /schema mismatch/i,
    /permission denied/i,
    /forbidden/i,
    /not authorized/i,
    /invalid tool/i,
    /no such tool/i,
];
/** Patterns indicating transient errors (retry may succeed). */
const TRANSIENT_PATTERNS = [
    /timeout/i,
    /timed out/i,
    /ETIMEDOUT/i,
    /ECONNREFUSED/i,
    /ECONNRESET/i,
    /network/i,
    /rate limit/i,
    /too many requests/i,
    /429/,
    /503/,
    /502/,
    /temporarily unavailable/i,
];
/** Patterns indicating server-level disconnect. */
const DISCONNECT_PATTERNS = [
    /server disconnected/i,
    /server stopped/i,
    /process exited/i,
    /EPIPE/i,
    /broken pipe/i,
];
/** Classify an error message into permanent, transient, or server_disconnect. */
function classifyError(errorMessage) {
    for (const pattern of DISCONNECT_PATTERNS) {
        if (pattern.test(errorMessage))
            return ErrorClass.SERVER_DISCONNECT;
    }
    for (const pattern of TRANSIENT_PATTERNS) {
        if (pattern.test(errorMessage))
            return ErrorClass.TRANSIENT;
    }
    for (const pattern of PERMANENT_PATTERNS) {
        if (pattern.test(errorMessage))
            return ErrorClass.PERMANENT;
    }
    // Default: treat unknown errors as transient (fail-safe, don't invalidate)
    return ErrorClass.TRANSIENT;
}
//# sourceMappingURL=error-classifier.js.map