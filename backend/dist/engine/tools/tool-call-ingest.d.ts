/**
 * Fire-and-forget ingest of tool call I/O into KB for context retention.
 * Excludes memory tools to prevent infinite loops.
 */
import { MemoryToolDispatcher } from '../memory/index.js';
/** Set the shared memory dispatcher reference for ingest hook. */
export declare function setIngestDispatcher(d: MemoryToolDispatcher): void;
/** Ingest tool call I/O if tool is not excluded. Fire-and-forget. */
export declare function maybeIngestToolCall(toolName: string, args: Record<string, unknown>, output: string): void;
