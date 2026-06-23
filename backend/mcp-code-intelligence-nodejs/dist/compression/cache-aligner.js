"use strict";
/**
 * CacheAligner — Date Extraction for KV Cache Optimization
 * KSA-244: Extracts dynamic dates from system prompts
 *
 * Replaces dates with stable placeholders, appends actual values at end.
 * Budget: < 0.5ms per system prompt.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheAligner = void 0;
// Date patterns to extract
const DATE_PATTERNS = [
    // "Today is July 14, 2025" or "Today is 2025-07-14"
    /\b(Today is|Current date:?|Date:?)\s+(\w+ \d{1,2},?\s*\d{4}|\d{4}-\d{2}-\d{2})/gi,
    // ISO dates: 2025-07-14
    /\b(\d{4}-\d{2}-\d{2})\b/g,
    // Long dates: July 14, 2025
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/gi,
];
class CacheAligner {
    /**
     * Extract dates from system prompt and replace with stable placeholders.
     * BR-30: Patterns include "Today is {date}", ISO dates, relative dates
     * BR-31: Only modify system prompts
     * BR-32: Skip ambiguous matches
     */
    align(systemPrompt) {
        if (!systemPrompt || systemPrompt.length === 0) {
            return { prompt: systemPrompt, extractedDates: [], modified: false };
        }
        const extractedDates = [];
        let modified = systemPrompt;
        let dateIndex = 0;
        for (const pattern of DATE_PATTERNS) {
            // Reset lastIndex for global patterns
            pattern.lastIndex = 0;
            modified = modified.replace(pattern, (match) => {
                // BR-32: Skip very short or ambiguous matches
                if (match.length < 8)
                    return match;
                dateIndex++;
                const placeholder = `{{DATE_${dateIndex}}}`;
                extractedDates.push({ placeholder, value: match });
                return placeholder;
            });
        }
        if (extractedDates.length === 0) {
            return { prompt: systemPrompt, extractedDates: [], modified: false };
        }
        // BR-33: Append actual values at end (stable position)
        const suffix = '\n\n---\n' + extractedDates
            .map(d => `${d.placeholder} = ${d.value}`)
            .join('\n');
        return {
            prompt: modified + suffix,
            extractedDates,
            modified: true,
        };
    }
}
exports.CacheAligner = CacheAligner;
//# sourceMappingURL=cache-aligner.js.map