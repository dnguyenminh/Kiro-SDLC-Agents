/**
 * ToolDefinitions — central registry of all tool schemas.
 * Loaded from tool-list.txt or defined inline for standalone mode.
 */
import type { ToolDefinition } from '../types/tool.js';
/**
 * Get all built-in tool definitions.
 * In production, this would load from .code-intel/tool-list.txt.
 * For now, module-level definitions are used.
 */
export declare function getBuiltinToolDefinitions(): ToolDefinition[];
