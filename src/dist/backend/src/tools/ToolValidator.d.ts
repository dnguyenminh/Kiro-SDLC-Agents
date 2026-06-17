/**
 * ToolValidator — validates tool call arguments using schemas.
 * Implements TDD §7.4 Input Validation.
 */
import { ToolDefinition } from '../types/tool';
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export declare class ToolValidator {
    validateToolCall(toolName: string, args: unknown, definition?: ToolDefinition): ValidationResult;
}
//# sourceMappingURL=ToolValidator.d.ts.map