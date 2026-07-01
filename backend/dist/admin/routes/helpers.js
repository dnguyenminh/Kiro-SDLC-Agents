// KSA-286: Router helpers — shared response utilities
export function apiSuccess(data) {
    return { success: true, data, meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() } };
}
export function apiError(code, message, status = 400) {
    return { status, body: { success: false, error: { code, message }, meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() } } };
}
export function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const size = Math.min(100, Math.max(1, parseInt(query.size || query.limit) || 20));
    return { page, size };
}
//# sourceMappingURL=helpers.js.map