"use strict";
/**
 * Tests for KSA-139: 2-Level Agent Tool Cache Registry.
 * Covers: models, config, lookup, writer, invalidator, injector, error-classifier.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const kb_models_js_1 = require("../kb-models.js");
const kb_config_js_1 = require("../kb-config.js");
const error_classifier_js_1 = require("../error-classifier.js");
const kb_lookup_js_1 = require("../kb-lookup.js");
const kb_writer_js_1 = require("../kb-writer.js");
const kb_invalidator_js_1 = require("../kb-invalidator.js");
const kb_injector_js_1 = require("../kb-injector.js");
// --- Models Tests ---
(0, node_test_1.describe)('kb-models', () => {
    (0, node_test_1.it)('cacheTitle builds correct format for global scope', () => {
        strict_1.default.equal((0, kb_models_js_1.cacheTitle)('global', 'jira_search'), 'tool-cache:global:jira_search');
    });
    (0, node_test_1.it)('cacheTitle builds correct format for agent scope', () => {
        strict_1.default.equal((0, kb_models_js_1.cacheTitle)('agent:ba-agent', 'kb_search'), 'tool-cache:agent:ba-agent:kb_search');
    });
    (0, node_test_1.it)('cacheTags builds global tags', () => {
        const tags = (0, kb_models_js_1.cacheTags)('global', 'atlassian');
        strict_1.default.equal(tags, 'tool-cache, scope:global, server:atlassian');
    });
    (0, node_test_1.it)('cacheTags builds agent tags', () => {
        const tags = (0, kb_models_js_1.cacheTags)('agent:sa-agent', 'kb-server');
        strict_1.default.equal(tags, 'tool-cache, agent:sa-agent, server:kb-server');
    });
    (0, node_test_1.it)('entryToKbContent serializes correctly', () => {
        const entry = (0, kb_models_js_1.createToolCacheEntry)('test_tool', 'server1', 'A test tool', { type: 'object' }, 'global');
        const content = (0, kb_models_js_1.entryToKbContent)(entry);
        const parsed = JSON.parse(content);
        strict_1.default.equal(parsed.tool_name, 'test_tool');
        strict_1.default.equal(parsed.server_name, 'server1');
        strict_1.default.equal(parsed.hits, 1);
    });
    (0, node_test_1.it)('entryFromKbContent deserializes correctly', () => {
        const json = JSON.stringify({ tool_name: 'x', server_name: 's', description: 'd', input_schema: {}, hits: 5, last_used: '2026-01-01T00:00:00Z' });
        const entry = (0, kb_models_js_1.entryFromKbContent)(json, 'global');
        strict_1.default.ok(entry);
        strict_1.default.equal(entry.toolName, 'x');
        strict_1.default.equal(entry.hits, 5);
        strict_1.default.equal(entry.scope, 'global');
    });
    (0, node_test_1.it)('entryFromKbContent returns null on invalid JSON', () => {
        strict_1.default.equal((0, kb_models_js_1.entryFromKbContent)('not json', 'global'), null);
    });
    (0, node_test_1.it)('entryFromKbContent returns null on missing required fields', () => {
        strict_1.default.equal((0, kb_models_js_1.entryFromKbContent)('{"description":"no name"}', 'global'), null);
    });
});
// --- Config Tests ---
(0, node_test_1.describe)('kb-config', () => {
    (0, node_test_1.it)('defaultKbCacheConfig returns sensible defaults', () => {
        const config = (0, kb_config_js_1.defaultKbCacheConfig)();
        strict_1.default.equal(config.enabled, true);
        strict_1.default.equal(config.injectCount, 5);
        strict_1.default.equal(config.lookupTimeoutMs, 100);
        strict_1.default.equal(config.maxEntriesPerScope, 100);
    });
    (0, node_test_1.it)('readKbCacheConfig returns defaults for missing file', () => {
        const config = (0, kb_config_js_1.readKbCacheConfig)('/nonexistent/path.json');
        strict_1.default.equal(config.enabled, true);
        strict_1.default.equal(config.injectCount, 5);
    });
});
// --- Error Classifier Tests ---
(0, node_test_1.describe)('error-classifier', () => {
    (0, node_test_1.it)('classifies "tool not found" as permanent', () => {
        strict_1.default.equal((0, error_classifier_js_1.classifyError)('Error: tool not found'), error_classifier_js_1.ErrorClass.PERMANENT);
    });
    (0, node_test_1.it)('classifies "permission denied" as permanent', () => {
        strict_1.default.equal((0, error_classifier_js_1.classifyError)('403 Permission denied'), error_classifier_js_1.ErrorClass.PERMANENT);
    });
    (0, node_test_1.it)('classifies "timeout" as transient', () => {
        strict_1.default.equal((0, error_classifier_js_1.classifyError)('Request timed out after 30s'), error_classifier_js_1.ErrorClass.TRANSIENT);
    });
    (0, node_test_1.it)('classifies "ECONNREFUSED" as transient', () => {
        strict_1.default.equal((0, error_classifier_js_1.classifyError)('connect ECONNREFUSED 127.0.0.1:9180'), error_classifier_js_1.ErrorClass.TRANSIENT);
    });
    (0, node_test_1.it)('classifies "rate limit" as transient', () => {
        strict_1.default.equal((0, error_classifier_js_1.classifyError)('429 Too Many Requests - rate limit exceeded'), error_classifier_js_1.ErrorClass.TRANSIENT);
    });
    (0, node_test_1.it)('classifies "server disconnected" as server_disconnect', () => {
        strict_1.default.equal((0, error_classifier_js_1.classifyError)('Server disconnected unexpectedly'), error_classifier_js_1.ErrorClass.SERVER_DISCONNECT);
    });
    (0, node_test_1.it)('classifies "process exited" as server_disconnect', () => {
        strict_1.default.equal((0, error_classifier_js_1.classifyError)('Child process exited with code 1'), error_classifier_js_1.ErrorClass.SERVER_DISCONNECT);
    });
    (0, node_test_1.it)('classifies unknown errors as transient (fail-safe)', () => {
        strict_1.default.equal((0, error_classifier_js_1.classifyError)('Something weird happened'), error_classifier_js_1.ErrorClass.TRANSIENT);
    });
});
// --- Mock Memory Engine ---
function createMockMemoryEngine(entries = []) {
    const store = [...entries];
    return {
        search: {
            search: (query, opts) => {
                // Simple tag-based filtering for tests
                const tags = opts?.tags ?? '';
                return store.filter((e) => {
                    if (tags && e._tags)
                        return e._tags.includes(tags.split(',')[0].trim());
                    return true;
                });
            },
        },
        knowledge: {
            insert: (data) => { store.push({ ...data, id: store.length + 1, _tags: data.tags }); },
            delete: (id) => { const idx = store.findIndex((e) => e.id === id); if (idx >= 0)
                store.splice(idx, 1); },
        },
    };
}
// --- Lookup Tests ---
(0, node_test_1.describe)('KbCacheLookup', () => {
    (0, node_test_1.it)('returns null when no entries exist', async () => {
        const mem = createMockMemoryEngine();
        const lookup = new kb_lookup_js_1.KbCacheLookup(mem, (0, kb_config_js_1.defaultKbCacheConfig)());
        const result = await lookup.find('jira search', 'ba-agent');
        strict_1.default.equal(result, null);
    });
    (0, node_test_1.it)('returns null when memoryEngine is null', async () => {
        const lookup = new kb_lookup_js_1.KbCacheLookup(null, (0, kb_config_js_1.defaultKbCacheConfig)());
        const result = await lookup.find('test', 'agent');
        strict_1.default.equal(result, null);
    });
    (0, node_test_1.it)('returns null when disabled', async () => {
        const mem = createMockMemoryEngine();
        const config = { ...(0, kb_config_js_1.defaultKbCacheConfig)(), enabled: false };
        const lookup = new kb_lookup_js_1.KbCacheLookup(mem, config);
        const result = await lookup.find('test', 'agent');
        strict_1.default.equal(result, null);
    });
});
// --- Writer Tests ---
(0, node_test_1.describe)('KbCacheWriter', () => {
    (0, node_test_1.it)('does nothing when disabled', async () => {
        const mem = createMockMemoryEngine();
        const config = { ...(0, kb_config_js_1.defaultKbCacheConfig)(), enabled: false };
        const writer = new kb_writer_js_1.KbCacheWriter(mem, config);
        await writer.onSuccess('tool', 'server', 'desc', {}, 'agent', kb_models_js_1.CacheSource.DISCOVERED);
        // No entries should be added
        const results = mem.search.search('tool-cache');
        strict_1.default.equal(results.length, 0);
    });
    (0, node_test_1.it)('ingests to L1 + L2 on DISCOVERED source', async () => {
        const mem = createMockMemoryEngine();
        const writer = new kb_writer_js_1.KbCacheWriter(mem, (0, kb_config_js_1.defaultKbCacheConfig)());
        await writer.onSuccess('jira_get', 'atlassian', 'Get issue', { type: 'object' }, 'ba-agent', kb_models_js_1.CacheSource.DISCOVERED);
        const results = mem.search.search('tool-cache');
        strict_1.default.ok(results.length >= 2); // L1 + L2
    });
    (0, node_test_1.it)('does nothing when memoryEngine is null', async () => {
        const writer = new kb_writer_js_1.KbCacheWriter(null, (0, kb_config_js_1.defaultKbCacheConfig)());
        // Should not throw
        await writer.onSuccess('tool', 'server', 'desc', {}, 'agent', kb_models_js_1.CacheSource.DISCOVERED);
    });
});
// --- Invalidator Tests ---
(0, node_test_1.describe)('KbCacheInvalidator', () => {
    (0, node_test_1.it)('does not invalidate on transient error', async () => {
        const mem = createMockMemoryEngine([
            { content: '{"tool_name":"x","server_name":"s"}', id: 1, _tags: 'tool-cache' },
        ]);
        const invalidator = new kb_invalidator_js_1.KbCacheInvalidator(mem);
        await invalidator.onFailure('x', 'agent', 'Request timed out');
        // Entry should still exist
        strict_1.default.equal(mem.search.search('tool-cache').length, 1);
    });
});
// --- Injector Tests ---
(0, node_test_1.describe)('KbInjectionEngine', () => {
    (0, node_test_1.it)('returns null when no cached tools', async () => {
        const mem = createMockMemoryEngine();
        const injector = new kb_injector_js_1.KbInjectionEngine(mem, (0, kb_config_js_1.defaultKbCacheConfig)());
        const result = await injector.getInjection('ba-agent');
        strict_1.default.equal(result, null);
    });
    (0, node_test_1.it)('returns null when inject_count is 0', async () => {
        const mem = createMockMemoryEngine();
        const config = { ...(0, kb_config_js_1.defaultKbCacheConfig)(), injectCount: 0 };
        const injector = new kb_injector_js_1.KbInjectionEngine(mem, config);
        const result = await injector.getInjection('ba-agent');
        strict_1.default.equal(result, null);
    });
    (0, node_test_1.it)('returns null when disabled', async () => {
        const mem = createMockMemoryEngine();
        const config = { ...(0, kb_config_js_1.defaultKbCacheConfig)(), enabled: false };
        const injector = new kb_injector_js_1.KbInjectionEngine(mem, config);
        const result = await injector.getInjection('ba-agent');
        strict_1.default.equal(result, null);
    });
    (0, node_test_1.it)('getInjectionPrompt returns empty string when no tools', async () => {
        const mem = createMockMemoryEngine();
        const injector = new kb_injector_js_1.KbInjectionEngine(mem, (0, kb_config_js_1.defaultKbCacheConfig)());
        const prompt = await injector.getInjectionPrompt('ba-agent');
        strict_1.default.equal(prompt, '');
    });
});
//# sourceMappingURL=kb-cache.test.js.map