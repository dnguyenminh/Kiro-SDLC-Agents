"use strict";
/**
 * ContentRouter — Content Type Detection
 * KSA-244: Classifies message content for compression routing
 *
 * Fast path: check first char before JSON.parse.
 * Budget: < 0.5ms per message.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentRouter = void 0;
class ContentRouter {
    /**
     * Detect content type and determine if compression should be applied.
     * Only JSON arrays trigger compression in v1.
     */
    detect(content, hint) {
        // Fast path: caller provides hint
        if (hint) {
            return {
                type: hint,
                shouldCompress: hint === 'json',
                compressor: hint === 'json' ? 'smartCrusher' : null,
            };
        }
        // BR-04: Minimum size check
        if (!content || content.length === 0) {
            return { type: 'empty', shouldCompress: false, compressor: null };
        }
        if (content.length < 100) {
            return { type: 'short', shouldCompress: false, compressor: null };
        }
        const trimmed = content.trimStart();
        // BR-01: JSON array detection (fast path: check first char)
        if (trimmed[0] === '[') {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return { type: 'json', shouldCompress: true, compressor: 'smartCrusher' };
                }
            }
            catch {
                // Not valid JSON — fall through to other heuristics
            }
        }
        // JSON object (not array) — no compression in v1
        if (trimmed[0] === '{') {
            try {
                JSON.parse(trimmed);
                return { type: 'json_object', shouldCompress: false, compressor: null };
            }
            catch {
                // Not valid JSON
            }
        }
        // BR-02: Code heuristic — check first 500 chars for syntax patterns
        const sample = content.substring(0, 500);
        if (/\b(import|export|function|class|const|interface|type|enum|namespace)\b/.test(sample)) {
            return { type: 'code', shouldCompress: false, compressor: null };
        }
        // BR-03: Log heuristic — >50% lines match timestamp pattern
        const lines = content.split('\n').slice(0, 20);
        const timestampPattern = /\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}|\[\d{2}\/\w+\/\d{4}/;
        const matchCount = lines.filter(l => timestampPattern.test(l)).length;
        if (lines.length > 0 && matchCount > lines.length * 0.5) {
            return { type: 'logs', shouldCompress: false, compressor: null };
        }
        // BR-05: Default classification
        return { type: 'text', shouldCompress: false, compressor: null };
    }
}
exports.ContentRouter = ContentRouter;
//# sourceMappingURL=content-router.js.map