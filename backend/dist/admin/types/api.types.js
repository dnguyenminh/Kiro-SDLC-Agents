/**
 * API response envelope types and error codes.
 * Implements: TDD §8, FSD §12.1 envelope format
 */
// ─── Error Codes (TDD §8.1) ────────────────────────────────────────────────
export var AdminErrorCode;
(function (AdminErrorCode) {
    // Auth
    AdminErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    AdminErrorCode["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    AdminErrorCode["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    AdminErrorCode["ROLE_DATA_DENIED"] = "ROLE_DATA_DENIED";
    AdminErrorCode["USER_DISABLED"] = "USER_DISABLED";
    // Validation
    AdminErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    AdminErrorCode["DUPLICATE_USERNAME"] = "DUPLICATE_USERNAME";
    AdminErrorCode["DUPLICATE_EMAIL"] = "DUPLICATE_EMAIL";
    AdminErrorCode["WEAK_PASSWORD"] = "WEAK_PASSWORD";
    AdminErrorCode["INVALID_ROLE_DATA"] = "INVALID_ROLE_DATA";
    // Business logic
    AdminErrorCode["LAST_SYSTEM_OWNER"] = "LAST_SYSTEM_OWNER";
    AdminErrorCode["CIRCULAR_LINK"] = "CIRCULAR_LINK";
    AdminErrorCode["ENTRY_NOT_FOUND"] = "ENTRY_NOT_FOUND";
    AdminErrorCode["GROUP_HAS_USERS"] = "GROUP_HAS_USERS";
    AdminErrorCode["PERMISSION_IN_USE"] = "PERMISSION_IN_USE";
    AdminErrorCode["IMPORT_TOO_LARGE"] = "IMPORT_TOO_LARGE";
    AdminErrorCode["CONCURRENT_EDIT"] = "CONCURRENT_EDIT";
    // System
    AdminErrorCode["SERVER_UNRESPONSIVE"] = "SERVER_UNRESPONSIVE";
    AdminErrorCode["RESTART_FAILED"] = "RESTART_FAILED";
    AdminErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    AdminErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
})(AdminErrorCode || (AdminErrorCode = {}));
// ─── Helper to create responses ─────────────────────────────────────────────
export function apiSuccess(data) {
    return { data, timestamp: new Date().toISOString() };
}
export function apiError(code, message, details) {
    return {
        error: { code, message, ...(details ? { details } : {}) },
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=api.types.js.map