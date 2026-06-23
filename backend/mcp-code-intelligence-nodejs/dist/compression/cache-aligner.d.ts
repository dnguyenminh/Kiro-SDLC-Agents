/**
 * CacheAligner — Date Extraction for KV Cache Optimization
 * KSA-244: Extracts dynamic dates from system prompts
 *
 * Replaces dates with stable placeholders, appends actual values at end.
 * Budget: < 0.5ms per system prompt.
 */
import { AlignedPrompt } from './types.js';
export declare class CacheAligner {
    /**
     * Extract dates from system prompt and replace with stable placeholders.
     * BR-30: Patterns include "Today is {date}", ISO dates, relative dates
     * BR-31: Only modify system prompts
     * BR-32: Skip ambiguous matches
     */
    align(systemPrompt: string): AlignedPrompt;
}
//# sourceMappingURL=cache-aligner.d.ts.map