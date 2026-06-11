/**
 * ToolValidator — validates tool call arguments using schemas.
 * Implements TDD §7.4 Input Validation.
 */

import { ToolDefinition } from '../types/tool';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class ToolValidator {
  validateToolCall(toolName: string, args: unknown, definition?: ToolDefinition): ValidationResult {
    const errors: string[] = [];

    if (!toolName || typeof toolName !== 'string') {
      errors.push('Missing required field: tool_name');
      return { valid: false, errors };
    }

    if (args !== undefined && args !== null && typeof args !== 'object') {
      errors.push('Arguments must be an object');
      return { valid: false, errors };
    }

    if (!definition) {
      errors.push(`Tool '${toolName}' not found`);
      return { valid: false, errors };
    }

    // Basic schema validation for required fields
    const schema = definition.inputSchema;
    if (schema && typeof schema === 'object') {
      const required = (schema as { required?: string[] }).required;
      if (required && Array.isArray(required)) {
        const argObj = (args as Record<string, unknown>) ?? {};
        for (const field of required) {
          if (!(field in argObj) || argObj[field] === undefined) {
            errors.push(`Missing required argument: ${field}`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
