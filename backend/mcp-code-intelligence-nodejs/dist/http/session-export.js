"use strict";
/**
 * Session export handler — generates markdown from session events.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSessionExport = handleSessionExport;
/** Export session as markdown grouped by task. */
function handleSessionExport(path, res, engine) {
    if (!engine) {
        sendError(res, 503, 'Memory not initialized');
        return;
    }
    const sessionId = path.split('/')[2];
    const events = engine.audit.listBySession(sessionId, 1000);
    if (events.length === 0) {
        sendError(res, 404, 'Session not found');
        return;
    }
    const markdown = buildExportMarkdown(sessionId, events);
    res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
    res.end(markdown);
}
/** Build markdown export from session events. */
function buildExportMarkdown(sessionId, events) {
    const first = events[0];
    const last = events[events.length - 1];
    const totalMs = events.reduce((s, e) => s + (e.duration_ms ?? 0), 0);
    const taskIds = [...new Set(events.map(e => e.task_id).filter(Boolean))];
    const lines = [
        `# Session: ${first.agent_name ?? 'unknown'} — ${first.created_at}`,
        `Duration: ${formatDuration(totalMs)} | Events: ${events.length} | Tasks: ${taskIds.length}`,
        '',
    ];
    for (const taskId of taskIds) {
        lines.push(`## Task: ${taskId}`);
        const taskEvents = events.filter(e => e.task_id === taskId);
        for (const ev of taskEvents)
            lines.push(formatEventLine(ev));
        lines.push('');
    }
    const ungrouped = events.filter(e => !e.task_id);
    if (ungrouped.length > 0) {
        lines.push('## Ungrouped Events');
        for (const ev of ungrouped)
            lines.push(formatEventLine(ev));
    }
    return lines.join('\n');
}
function formatEventLine(ev) {
    const time = ev.created_at?.slice(11, 19) ?? '';
    const tool = ev.tool_name ?? ev.operation;
    const dur = ev.duration_ms ? `(${ev.duration_ms}ms)` : '';
    const summary = ev.result_summary ? ` → ${ev.result_summary.slice(0, 80)}` : '';
    return `- [${time}] **${tool}** ${dur}: ${ev.details?.slice(0, 100) ?? ''}${summary}`;
}
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    const sec = Math.floor(ms / 1000);
    if (sec < 60)
        return `${sec}s`;
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}
function sendError(res, code, message) {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
}
//# sourceMappingURL=session-export.js.map