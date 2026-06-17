/**
 * ToolValidator — validates tool call arguments using schemas.
 * Implements TDD §7.4 Input Validation.
 */
export class ToolValidator {
    validateToolCall(toolName, args, definition) {
        const errors = [];
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
            const required = schema.required;
            if (required && Array.isArray(required)) {
                const argObj = args ?? {};
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
//# sourceMappingURL=ToolValidator.js.map