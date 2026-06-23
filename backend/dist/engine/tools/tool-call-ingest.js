/**
 * Fire-and-forget ingest of tool call I/O into KB for context retention.
 * Excludes memory tools to prevent infinite loops.
 */
/** Memory tools excluded to prevent infinite ingest loops. */
const EXCLUDE_SET = new Set([
    'mem_ingest', 'mem_search', 'mem_ingest_file', 'mem_crud',
    'mem_graph', 'mem_consolidate', 'mem_lifecycle', 'mem_templates',
    'mem_attachments', 'mem_discover', 'mem_tags', 'mem_citations',
    'mem_scoring', 'mem_admin', 'mem_get', 'mem_delete',
    'mem_list', 'mem_status', 'mem_sessions', 'mem_sync_code',
]);
let dispatcher = null;
/** Set the shared memory dispatcher reference for ingest hook. */
export function setIngestDispatcher(d) {
    dispatcher = d;
}
/** Ingest tool call I/O if tool is not excluded. Fire-and-forget. */
export function maybeIngestToolCall(toolName, args, output) {
    if (!dispatcher)
        return;
    if (EXCLUDE_SET.has(toolName))
        return;
    try {
        const content = `${toolName}: ${JSON.stringify(args)}\n---\n${output}`;
        dispatcher.dispatch('mem_ingest', {
            content,
            type: 'CONTEXT',
            source: 'tool-call-stream',
            tags: `tool-call,${toolName}`,
        });
    }
    catch {
        // Fire-and-forget — never block tool response
    }
}
//# sourceMappingURL=tool-call-ingest.js.map