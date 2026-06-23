"use strict";
/**
 * StreamHandler — KSA-231
 * Parses Server-Sent Events (SSE) from Kiro API responses into structured events.
 * Implements AsyncGenerator pattern for backpressure-friendly streaming.
 * Zero dependencies — pure TypeScript processing of text/event-stream.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KiroStreamError = exports.StreamHandler = void 0;
// ─── StreamHandler ────────────────────────────────────────────────────────────
class StreamHandler {
    /**
     * Process SSE response into text-only stream.
     * Yields text deltas from content_block_delta events.
     * Supports abort via AbortSignal.
     */
    async *processStream(response, signal) {
        if (!response.body) {
            throw new KiroStreamError("Response has no body for streaming");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let chunkCount = 0;
        try {
            while (true) {
                if (signal?.aborted) {
                    await reader.cancel();
                    return;
                }
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith("data: ")) {
                        continue;
                    }
                    const data = trimmed.slice(6);
                    if (data === "[DONE]") {
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const text = this.extractTextDelta(parsed);
                        if (text) {
                            yield text;
                            chunkCount++;
                            // Backpressure: yield microtask boundary every 100 chunks
                            if (chunkCount % 100 === 0) {
                                await Promise.resolve();
                            }
                        }
                        // Check for message_stop
                        if (parsed.type === "message_stop") {
                            return;
                        }
                    }
                    catch {
                        // Skip malformed SSE data — continue processing
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    /**
     * Process SSE response with full event types (text + tool_use).
     * Used for chatWithTools to capture tool call blocks.
     */
    async *processStreamWithToolUse(response, signal) {
        if (!response.body) {
            throw new KiroStreamError("Response has no body for streaming");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let chunkCount = 0;
        // Track tool_use blocks being assembled
        const toolBlocks = new Map();
        try {
            while (true) {
                if (signal?.aborted) {
                    await reader.cancel();
                    return;
                }
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith("data: ")) {
                        continue;
                    }
                    const data = trimmed.slice(6);
                    if (data === "[DONE]") {
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        // content_block_start for tool_use
                        if (parsed.type === "content_block_start" && parsed.content_block?.type === "tool_use") {
                            toolBlocks.set(parsed.index, {
                                id: parsed.content_block.id,
                                name: parsed.content_block.name,
                                jsonBuffer: "",
                            });
                            continue;
                        }
                        // content_block_delta for text
                        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                            const text = parsed.delta.text;
                            if (text) {
                                yield { type: "text", text };
                                chunkCount++;
                                if (chunkCount % 100 === 0) {
                                    await Promise.resolve();
                                }
                            }
                            continue;
                        }
                        // content_block_delta for tool_use input JSON
                        if (parsed.type === "content_block_delta" && parsed.delta?.type === "input_json_delta") {
                            const block = toolBlocks.get(parsed.index);
                            if (block) {
                                block.jsonBuffer += parsed.delta.partial_json || "";
                            }
                            continue;
                        }
                        // content_block_stop — emit tool_use if we were building one
                        if (parsed.type === "content_block_stop") {
                            const block = toolBlocks.get(parsed.index);
                            if (block) {
                                let input = {};
                                try {
                                    input = JSON.parse(block.jsonBuffer);
                                }
                                catch { /* empty */ }
                                yield { type: "tool_use", id: block.id, name: block.name, input };
                                toolBlocks.delete(parsed.index);
                            }
                            continue;
                        }
                        // message_delta — contains usage info
                        if (parsed.type === "message_delta") {
                            // We don't yield this — it comes before message_stop
                            continue;
                        }
                        // message_stop
                        if (parsed.type === "message_stop") {
                            yield { type: "message_stop", usage: parsed.usage };
                            return;
                        }
                    }
                    catch {
                        // Skip malformed SSE data
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    // ─── Internal ─────────────────────────────────────────────────────────────
    extractTextDelta(parsed) {
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
            return parsed.delta.text || null;
        }
        return null;
    }
}
exports.StreamHandler = StreamHandler;
// ─── Error Class ──────────────────────────────────────────────────────────────
class KiroStreamError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "KiroStreamError";
    }
}
exports.KiroStreamError = KiroStreamError;
//# sourceMappingURL=stream-handler.js.map