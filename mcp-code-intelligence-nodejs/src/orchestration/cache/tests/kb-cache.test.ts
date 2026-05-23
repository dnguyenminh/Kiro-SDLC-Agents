/**
 * Tests for KSA-139: 2-Level Agent Tool Cache Registry.
 * Covers: models, config, lookup, writer, invalidator, injector, error-classifier.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  ToolCacheEntry, CacheSource, cacheTitle, cacheTags,
  entryToKbContent, entryFromKbContent, createToolCacheEntry,
} from '../kb-models.js';
import { readKbCacheConfig, defaultKbCacheConfig } from '../kb-config.js';
import { classifyError, ErrorClass } from '../error-classifier.js';
import { KbCacheLookup } from '../kb-lookup.js';
import { KbCacheWriter } from '../kb-writer.js';
import { KbCacheInvalidator } from '../kb-invalidator.js';
import { KbInjectionEngine } from '../kb-injector.js';

// --- Models Tests ---

describe('kb-models', () => {
  it('cacheTitle builds correct format for global scope', () => {
    assert.equal(cacheTitle('global', 'jira_search'), 'tool-cache:global:jira_search');
  });

  it('cacheTitle builds correct format for agent scope', () => {
    assert.equal(cacheTitle('agent:ba-agent', 'kb_search'), 'tool-cache:agent:ba-agent:kb_search');
  });

  it('cacheTags builds global tags', () => {
    const tags = cacheTags('global', 'atlassian');
    assert.equal(tags, 'tool-cache, scope:global, server:atlassian');
  });

  it('cacheTags builds agent tags', () => {
    const tags = cacheTags('agent:sa-agent', 'kb-server');
    assert.equal(tags, 'tool-cache, agent:sa-agent, server:kb-server');
  });

  it('entryToKbContent serializes correctly', () => {
    const entry = createToolCacheEntry('test_tool', 'server1', 'A test tool', { type: 'object' }, 'global');
    const content = entryToKbContent(entry);
    const parsed = JSON.parse(content);
    assert.equal(parsed.tool_name, 'test_tool');
    assert.equal(parsed.server_name, 'server1');
    assert.equal(parsed.hits, 1);
  });

  it('entryFromKbContent deserializes correctly', () => {
    const json = JSON.stringify({ tool_name: 'x', server_name: 's', description: 'd', input_schema: {}, hits: 5, last_used: '2026-01-01T00:00:00Z' });
    const entry = entryFromKbContent(json, 'global');
    assert.ok(entry);
    assert.equal(entry!.toolName, 'x');
    assert.equal(entry!.hits, 5);
    assert.equal(entry!.scope, 'global');
  });

  it('entryFromKbContent returns null on invalid JSON', () => {
    assert.equal(entryFromKbContent('not json', 'global'), null);
  });

  it('entryFromKbContent returns null on missing required fields', () => {
    assert.equal(entryFromKbContent('{"description":"no name"}', 'global'), null);
  });
});

// --- Config Tests ---

describe('kb-config', () => {
  it('defaultKbCacheConfig returns sensible defaults', () => {
    const config = defaultKbCacheConfig();
    assert.equal(config.enabled, true);
    assert.equal(config.injectCount, 5);
    assert.equal(config.lookupTimeoutMs, 100);
    assert.equal(config.maxEntriesPerScope, 100);
  });

  it('readKbCacheConfig returns defaults for missing file', () => {
    const config = readKbCacheConfig('/nonexistent/path.json');
    assert.equal(config.enabled, true);
    assert.equal(config.injectCount, 5);
  });
});

// --- Error Classifier Tests ---

describe('error-classifier', () => {
  it('classifies "tool not found" as permanent', () => {
    assert.equal(classifyError('Error: tool not found'), ErrorClass.PERMANENT);
  });

  it('classifies "permission denied" as permanent', () => {
    assert.equal(classifyError('403 Permission denied'), ErrorClass.PERMANENT);
  });

  it('classifies "timeout" as transient', () => {
    assert.equal(classifyError('Request timed out after 30s'), ErrorClass.TRANSIENT);
  });

  it('classifies "ECONNREFUSED" as transient', () => {
    assert.equal(classifyError('connect ECONNREFUSED 127.0.0.1:9180'), ErrorClass.TRANSIENT);
  });

  it('classifies "rate limit" as transient', () => {
    assert.equal(classifyError('429 Too Many Requests - rate limit exceeded'), ErrorClass.TRANSIENT);
  });

  it('classifies "server disconnected" as server_disconnect', () => {
    assert.equal(classifyError('Server disconnected unexpectedly'), ErrorClass.SERVER_DISCONNECT);
  });

  it('classifies "process exited" as server_disconnect', () => {
    assert.equal(classifyError('Child process exited with code 1'), ErrorClass.SERVER_DISCONNECT);
  });

  it('classifies unknown errors as transient (fail-safe)', () => {
    assert.equal(classifyError('Something weird happened'), ErrorClass.TRANSIENT);
  });
});

// --- Mock Memory Engine ---

function createMockMemoryEngine(entries: Record<string, any>[] = []) {
  const store: Record<string, any>[] = [...entries];
  return {
    search: {
      search: (query: string, opts?: any) => {
        // Simple tag-based filtering for tests
        const tags = opts?.tags ?? '';
        return store.filter((e) => {
          if (tags && e._tags) return e._tags.includes(tags.split(',')[0].trim());
          return true;
        });
      },
    },
    knowledge: {
      insert: (data: any) => { store.push({ ...data, id: store.length + 1, _tags: data.tags }); },
      delete: (id: number) => { const idx = store.findIndex((e) => e.id === id); if (idx >= 0) store.splice(idx, 1); },
    },
  };
}

// --- Lookup Tests ---

describe('KbCacheLookup', () => {
  it('returns null when no entries exist', async () => {
    const mem = createMockMemoryEngine();
    const lookup = new KbCacheLookup(mem, defaultKbCacheConfig());
    const result = await lookup.find('jira search', 'ba-agent');
    assert.equal(result, null);
  });

  it('returns null when memoryEngine is null', async () => {
    const lookup = new KbCacheLookup(null, defaultKbCacheConfig());
    const result = await lookup.find('test', 'agent');
    assert.equal(result, null);
  });

  it('returns null when disabled', async () => {
    const mem = createMockMemoryEngine();
    const config = { ...defaultKbCacheConfig(), enabled: false };
    const lookup = new KbCacheLookup(mem, config);
    const result = await lookup.find('test', 'agent');
    assert.equal(result, null);
  });
});

// --- Writer Tests ---

describe('KbCacheWriter', () => {
  it('does nothing when disabled', async () => {
    const mem = createMockMemoryEngine();
    const config = { ...defaultKbCacheConfig(), enabled: false };
    const writer = new KbCacheWriter(mem, config);
    await writer.onSuccess('tool', 'server', 'desc', {}, 'agent', CacheSource.DISCOVERED);
    // No entries should be added
    const results = mem.search.search('tool-cache');
    assert.equal(results.length, 0);
  });

  it('ingests to L1 + L2 on DISCOVERED source', async () => {
    const mem = createMockMemoryEngine();
    const writer = new KbCacheWriter(mem, defaultKbCacheConfig());
    await writer.onSuccess('jira_get', 'atlassian', 'Get issue', { type: 'object' }, 'ba-agent', CacheSource.DISCOVERED);
    const results = mem.search.search('tool-cache');
    assert.ok(results.length >= 2); // L1 + L2
  });

  it('does nothing when memoryEngine is null', async () => {
    const writer = new KbCacheWriter(null, defaultKbCacheConfig());
    // Should not throw
    await writer.onSuccess('tool', 'server', 'desc', {}, 'agent', CacheSource.DISCOVERED);
  });
});

// --- Invalidator Tests ---

describe('KbCacheInvalidator', () => {
  it('does not invalidate on transient error', async () => {
    const mem = createMockMemoryEngine([
      { content: '{"tool_name":"x","server_name":"s"}', id: 1, _tags: 'tool-cache' },
    ]);
    const invalidator = new KbCacheInvalidator(mem);
    await invalidator.onFailure('x', 'agent', 'Request timed out');
    // Entry should still exist
    assert.equal(mem.search.search('tool-cache').length, 1);
  });
});

// --- Injector Tests ---

describe('KbInjectionEngine', () => {
  it('returns null when no cached tools', async () => {
    const mem = createMockMemoryEngine();
    const injector = new KbInjectionEngine(mem, defaultKbCacheConfig());
    const result = await injector.getInjection('ba-agent');
    assert.equal(result, null);
  });

  it('returns null when inject_count is 0', async () => {
    const mem = createMockMemoryEngine();
    const config = { ...defaultKbCacheConfig(), injectCount: 0 };
    const injector = new KbInjectionEngine(mem, config);
    const result = await injector.getInjection('ba-agent');
    assert.equal(result, null);
  });

  it('returns null when disabled', async () => {
    const mem = createMockMemoryEngine();
    const config = { ...defaultKbCacheConfig(), enabled: false };
    const injector = new KbInjectionEngine(mem, config);
    const result = await injector.getInjection('ba-agent');
    assert.equal(result, null);
  });

  it('getInjectionPrompt returns empty string when no tools', async () => {
    const mem = createMockMemoryEngine();
    const injector = new KbInjectionEngine(mem, defaultKbCacheConfig());
    const prompt = await injector.getInjectionPrompt('ba-agent');
    assert.equal(prompt, '');
  });
});
