/**
 * Request Validator — KSA-237
 * Validates incoming Anthropic Messages API requests.
 */
import { AnthropicError } from './types.js';
export interface ValidationResult {
    valid: boolean;
    error?: AnthropicError;
}
export declare function validateRequest(body: unknown): ValidationResult;
//# sourceMappingURL=request-validator.d.ts.map