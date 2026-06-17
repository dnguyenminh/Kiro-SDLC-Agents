/**
 * ToolValidator — validates tool call arguments against their schemas using zod.
 */
import type { ToolDefinition } from '../types/tool.js';
export declare class ToolValidator {
    /**
     * Validate arguments against a tool's inputSchema.
     * Returns null if valid, or error message string if invalid.
     */
    validate(tool: ToolDefinition, args: Record<string, unknown>): string | null;
    private checkType;
}
