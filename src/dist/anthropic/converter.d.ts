import { KiroQResponse, SSEEvent } from './types';
/**
 * Convert a Kiro Q API response into a sequence of SSE events.
 *
 * CRITICAL (BR-1): The tool_use_id from the API response MUST be passed
 * through UNCHANGED. No new ID generation, no mapping, no transformation.
 */
export declare function convertResponseToSSEEvents(response: KiroQResponse): SSEEvent[];
/**
 * Extract tool_use_ids from a Kiro Q response for history storage.
 * Returns the SAME ids that will be streamed to the client.
 *
 * CRITICAL (BR-2): These ids must EXACTLY match what convertResponseToSSEEvents produces.
 */
export declare function extractToolUseIds(response: KiroQResponse): string[];
/**
 * Validate a tool_use_id format (BR-3).
 * Pattern: tooluse_[A-Za-z0-9]+
 */
export declare function validateToolUseId(id: unknown): id is string;
//# sourceMappingURL=converter.d.ts.map