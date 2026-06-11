/**
 * Unit tests for ToolDefinitions.
 */

import { describe, it, expect } from 'vitest';
import { ALL_TOOL_NAMES, categorizeToolName, validateToolCount } from '../src/tools/ToolDefinitions';

describe('ToolDefinitions', () => {
  it('has exactly 52 tools', () => {
    expect(ALL_TOOL_NAMES.length).toBe(52);
    expect(validateToolCount()).toBe(true);
  });

  it('categorizes memory tools correctly', () => {
    expect(categorizeToolName('mem_search')).toBe('memory');
    expect(categorizeToolName('mem_ingest')).toBe('memory');
    expect(categorizeToolName('mem_admin')).toBe('memory');
  });

  it('categorizes code tools correctly', () => {
    expect(categorizeToolName('code_search')).toBe('code');
    expect(categorizeToolName('code_symbols')).toBe('code');
    expect(categorizeToolName('find_entry_points')).toBe('code');
    expect(categorizeToolName('git_search')).toBe('code');
    expect(categorizeToolName('complexity_analysis')).toBe('code');
  });

  it('categorizes orchestration tools correctly', () => {
    expect(categorizeToolName('find_tools')).toBe('orchestration');
    expect(categorizeToolName('execute_dynamic_tool')).toBe('orchestration');
    expect(categorizeToolName('orchestration_status')).toBe('orchestration');
  });

  it('categorizes utility tools correctly', () => {
    expect(categorizeToolName('agent_log')).toBe('utility');
    expect(categorizeToolName('stream_write_file')).toBe('utility');
    expect(categorizeToolName('drawio_export_png')).toBe('utility');
  });
});
