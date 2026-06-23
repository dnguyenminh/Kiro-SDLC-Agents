/**
 * ToolDefinitions — complete list of all 52 MCP tools.
 * Sourced from .code-intel/tool-list.txt.
 * Implements TDD §5.2 tools/ToolDefinitions.ts.
 */
import { ToolDefinition } from '../types/tool';
/**
 * Categorize a tool name into its module category.
 */
export declare function categorizeToolName(name: string): ToolDefinition['category'];
/**
 * All 52 tool names from the tool-list.txt.
 */
export declare const ALL_TOOL_NAMES: readonly ["code_search", "code_symbols", "code_context", "code_modules", "code_index_status", "stream_write_file", "code_kb_export", "drawio_auto_layout", "code_callers", "code_callees", "code_dependencies", "code_impact", "code_traverse", "complexity_analysis", "find_entry_points", "find_circular_deps", "find_related_tests", "find_hot_paths", "find_dead_imports", "module_summary", "get_ai_context", "get_edit_context", "get_curated_context", "find_duplicates", "find_dead_code", "git_search", "git_index", "mem_search", "mem_ingest", "mem_ingest_file", "mem_pin", "mem_map", "mem_crud", "mem_graph", "mem_consolidate", "mem_lifecycle", "mem_templates", "mem_attachments", "mem_discover", "mem_tags", "mem_citations", "mem_conversation", "mem_scoring", "mem_admin", "find_tools", "execute_dynamic_tool", "toggle_tool", "reset_tools", "manage_auto_approve", "orchestration_status", "agent_log", "drawio_export_png"];
export type ToolName = typeof ALL_TOOL_NAMES[number];
/**
 * Verify all 52 tools are accounted for.
 */
export declare function validateToolCount(): boolean;
//# sourceMappingURL=ToolDefinitions.d.ts.map