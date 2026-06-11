/**
 * Unit tests for ToolValidator.
 */

import { describe, it, expect } from 'vitest';
import { ToolValidator } from '../src/tools/ToolValidator';
import { ToolDefinition } from '../src/types/tool';

describe('ToolValidator', () => {
  const validator = new ToolValidator();

  const sampleDef: ToolDefinition = {
    name: 'mem_search',
    description: 'Search memory',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
      required: ['query'],
    },
    category: 'memory',
  };

  it('validates valid tool call', () => {
    const result = validator.validateToolCall('mem_search', { query: 'test' }, sampleDef);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing tool_name', () => {
    const result = validator.validateToolCall('', { query: 'test' }, sampleDef);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('tool_name');
  });

  it('rejects non-object arguments', () => {
    const result = validator.validateToolCall('mem_search', 'not-an-object' as any, sampleDef);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('object');
  });

  it('rejects unknown tool (no definition)', () => {
    const result = validator.validateToolCall('unknown_tool', {}, undefined);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not found');
  });

  it('validates required fields', () => {
    const result = validator.validateToolCall('mem_search', {}, sampleDef);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('query');
  });

  it('allows optional fields to be missing', () => {
    const result = validator.validateToolCall('mem_search', { query: 'test' }, sampleDef);
    expect(result.valid).toBe(true);
  });
});
