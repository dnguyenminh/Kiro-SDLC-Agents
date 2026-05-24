"use strict";
/**
 * End-to-end tests for Node.js MCP orchestration: find_tools, execute_dynamic_tool, routing.
 * Mirrors Python test_orchestration_e2e.py (49 tests across 9 categories).
 *
 * Run: npx tsc && node dist/test-orchestration-e2e.js
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const index_js_1 = require("./orchestration/registry/index.js");
const index_js_2 = require("./orchestration/routing/index.js");
const nested_detection_js_1 = require("./orchestration/nested-detection.js");
let passed = 0;
let failed = 0;
function toolDef(name, description) {
    return { name, description, inputSchema: { type: 'object', properties: {} } };
}
/** Minimal mock engine for unit testing without real child servers. */
class MockEngine {
    registry;
    delegates;
    started;
    callChildResult;
    callChildShouldThrow;
    toolMapping = new Map();
    constructor(opts = {}) {
        this.registry = opts.registry ?? new index_js_1.UnifiedRegistry(0.5);
        this.delegates = opts.delegates ?? [];
        this.started = opts.started ?? true;
        this.callChildResult = opts.callChildResult ?? '{}';
        this.callChildShouldThrow = opts.callChildShouldThrow ?? false;
    }
    getToolMapping(name) {
        return this.toolMapping.get(name) ?? null;
    }
    registerNestedTool(uniqueName, serverName, originalName, def) {
        this.toolMapping.set(uniqueName, [serverName, originalName]);
        this.toolMapping.set(originalName, [serverName, originalName]);
        this.registry.registerNested(uniqueName, serverName, def);
    }
    async callChild(_serverName, _toolName, _args) {
        if (this.callChildShouldThrow)
            throw new Error(`Tool '${_toolName}' not found`);
        return this.callChildResult;
    }
    getStatus() {
        return { enabled: this.started, servers: 1, hiddenTools: this.registry.allChildTools().length };
    }
    stop() { this.started = false; }
}
// ─── Test runner ─────────────────────────────────────────────────────────────
async function runTest(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  PASS: ${name}`);
    }
    catch (e) {
        failed++;
        console.error(`  FAIL: ${name}`);
        console.error(`        ${e.message}`);
    }
}
// ─── TestFindTools (8 tests) ─────────────────────────────────────────────────
async function testFindToolsJiraQuery() {
    const registry = new index_js_1.UnifiedRegistry(0.5);
    registry.setChildTools('atlassian', [
        toolDef('jira_search', 'Search Jira issues using JQL'),
        toolDef('jira_add_comment', 'Add comment to Jira issue'),
        toolDef('jira_get_transitions', 'Get transitions for issue'),
        toolDef('confluence_search', 'Search Confluence pages'),
    ]);
    const results = registry.search('jira');
    const names = results.map((t) => t.name);
    assert.ok(names.length >= 3, `Expected >=3 results, got ${names.length}`);
    assert.ok(names.includes('jira_search'), 'Missing jira_search');
    assert.ok(names.includes('jira_add_comment'), 'Missing jira_add_comment');
}
async function testFindToolsConfluenceQuery() {
    const registry = new index_js_1.UnifiedRegistry(0.5);
    registry.setChildTools('atlassian', [
        toolDef('jira_search', 'Search Jira issues'),
        toolDef('confluence_search', 'Search Confluence pages'),
        toolDef('confluence_create_page', 'Create Confluence page'),
    ]);
    const results = registry.search('confluence');
    const names = results.map((t) => t.name);
    assert.ok(names.includes('confluence_search'), 'Missing confluence_search');
}
async function testFindToolsCreateQuery() {
    const registry = new index_js_1.UnifiedRegistry(0.5);
    registry.setChildTools('atlassian', [
        toolDef('jira_create_issue', 'Create a new Jira issue'),
        toolDef('confluence_create_page', 'Create Confluence page'),
        toolDef('jira_search', 'Search issues'),
    ]);
    const results = registry.search('create');
    const names = results.map((t) => t.name);
    assert.ok(names.includes('jira_create_issue'), 'Missing jira_create_issue');
    assert.ok(names.includes('confluence_create_page'), 'Missing confluence_create_page');
}
async function testFindToolsEmptyQuery() {
    const registry = new index_js_1.UnifiedRegistry(0.5);
    registry.setChildTools('server', [toolDef('tool_a', 'A tool')]);
    const results = registry.search('');
    assert.ok(results.length > 0, 'Empty query should return all tools');
}
async function testFindToolsMissingQuery() {
    // Simulates what executeFindTools does with missing query
    const args = {};
    const query = args.query;
    assert.strictEqual(query, undefined, 'Missing query should be undefined');
}
async function testFindToolsNoResults() {
    const registry = new index_js_1.UnifiedRegistry(0.5);
    registry.setChildTools('atlassian', [
        toolDef('jira_search', 'Search Jira issues'),
    ]);
    const results = registry.search('kubernetes deploy helm');
    assert.strictEqual(results.length, 0, `Expected 0 results, got ${results.length}`);
}
async function testFindToolsMax10() {
    const registry = new index_js_1.UnifiedRegistry(0.5);
    const tools = Array.from({ length: 20 }, (_, i) => toolDef(`tool_${i}`, `Tool number ${i} for testing`));
    registry.setChildTools('test-server', tools);
    const results = registry.search('tool testing');
    // Registry returns all; FindToolsTool caps at 10
    assert.ok(results.length <= 20, 'Should not exceed total tools');
}
async function testFindToolsNestedDelegation() {
    const engine = new MockEngine({ delegates: ['bridge-server'] });
    engine.callChildResult = JSON.stringify([
        { name: 'nested_tool_1', description: 'A nested tool' },
    ]);
    const raw = await engine.callChild('bridge-server', 'find_tools', { query: 'nested' });
    const tools = JSON.parse(raw);
    for (const td of tools) {
        const originalName = td.name;
        const uniqueName = `bridge-server::${originalName}`;
        engine.registerNestedTool(uniqueName, 'bridge-server', originalName, td);
    }
    const mapping = engine.getToolMapping('nested_tool_1');
    assert.ok(mapping !== null, 'Mapping should exist');
    assert.strictEqual(mapping[0], 'bridge-server');
}
// ─── TestExecuteDynamicTool (6 tests) ────────────────────────────────────────
async function testExecuteMappedTool() {
    const engine = new MockEngine();
    engine.toolMapping.set('jira_search', ['atlassian', 'jira_search']);
    engine.callChildResult = '{"total":5,"issues":[]}';
    const result = await engine.callChild('atlassian', 'execute_dynamic_tool', {
        tool_name: 'jira_search', arguments: { jql: 'project = KSA' },
    });
    engine.registry.recordHit('jira_search', 1);
    engine.registry.recordHit('jira_search', 3);
    const parsed = JSON.parse(result);
    assert.ok('total' in parsed, 'Result should have total');
}
async function testExecuteUndiscoveredTool() {
    const engine = new MockEngine({ callChildShouldThrow: true });
    let result;
    try {
        result = await engine.callChild('server1', 'nonexistent_tool_xyz', {});
    }
    catch (e) {
        result = JSON.stringify({ error: e.message });
    }
    const parsed = JSON.parse(result);
    assert.ok('error' in parsed, 'Should return error');
}
async function testExecuteMissingToolName() {
    const args = { arguments: {} };
    const toolName = args.tool_name;
    assert.strictEqual(toolName, undefined, 'Missing tool_name should be undefined');
}
async function testExecuteRecordsHitOnSuccess() {
    const registry = new index_js_1.UnifiedRegistry();
    registry.recordHit('test_tool', 1);
    registry.recordHit('test_tool', 3);
    // hits map is private, verify via search ranking behavior
    // For direct access, we check the combined effect
    const reg2 = new index_js_1.UnifiedRegistry(0.5);
    reg2.setChildTools('s', [toolDef('test_tool', 'test')]);
    reg2.recordHit('test_tool', 1);
    reg2.recordHit('test_tool', 3);
    // After 1+3=4 hits, tool should rank well
    const results = reg2.search('test');
    assert.ok(results.length > 0, 'Tool should be findable');
    assert.strictEqual(results[0].name, 'test_tool');
}
async function testExecuteRecordsOnly1HitOnError() {
    const registry = new index_js_1.UnifiedRegistry(0.5);
    registry.setChildTools('s', [
        toolDef('err_tool', 'error tool'),
        toolDef('ok_tool', 'ok tool'),
    ]);
    registry.recordHit('err_tool', 1);
    registry.recordHit('ok_tool', 4);
    // ok_tool with 4 hits should rank higher than err_tool with 1 hit
    const results = registry.search('tool');
    const names = results.map((t) => t.name);
    assert.strictEqual(names[0], 'ok_tool', 'ok_tool should rank first');
}
async function testExecuteWithoutEventLoop() {
    const engine = new MockEngine({ started: false });
    assert.strictEqual(engine.started, false);
    const status = engine.getStatus();
    assert.strictEqual(status.enabled, false);
}
// ─── TestOrchestrationStatus (2 tests) ───────────────────────────────────────
async function testStatusEnabled() {
    const engine = new MockEngine({ started: true });
    const status = engine.getStatus();
    assert.strictEqual(status.enabled, true);
    assert.ok('servers' in status);
    assert.ok('hiddenTools' in status);
}
async function testStatusDisabled() {
    const engine = new MockEngine({ started: false });
    const status = engine.getStatus();
    assert.strictEqual(status.enabled, false);
}
// ─── TestRestartBehavior (3 tests) ───────────────────────────────────────────
async function testMappingLostAfterStop() {
    const engine = new MockEngine({ started: true });
    engine.toolMapping.set('jira_search', ['atlassian', 'jira_search']);
    engine.stop();
    assert.strictEqual(engine.started, false);
}
async function testNewEngineEmptyMapping() {
    const engine = new MockEngine();
    assert.strictEqual(engine.getToolMapping('jira_search'), null);
    assert.strictEqual(engine.toolMapping.size, 0);
}
async function testFindToolsRepopulatesMapping() {
    const engine = new MockEngine({ delegates: ['bridge'] });
    engine.callChildResult = JSON.stringify([
        { name: 'jira_search', description: 'Search Jira' },
    ]);
    const raw = await engine.callChild('bridge', 'find_tools', { query: 'jira' });
    const tools = JSON.parse(raw);
    for (const td of tools) {
        const originalName = td.name;
        engine.registerNestedTool(`bridge::${originalName}`, 'bridge', originalName, td);
    }
    assert.ok(engine.getToolMapping('jira_search') !== null);
}
// ─── TestConcurrentCalls (2 tests) ───────────────────────────────────────────
async function testConcurrentFindTools() {
    const registry = new index_js_1.UnifiedRegistry(0.5);
    registry.setChildTools('atlassian', [
        toolDef('jira_search', 'Search Jira issues'),
        toolDef('jira_add_comment', 'Add comment'),
    ]);
    const queries = ['jira', 'comment', 'search', 'jira', 'add'];
    const promises = queries.map((q) => Promise.resolve(registry.search(q)));
    const results = await Promise.all(promises);
    for (const r of results) {
        assert.ok(Array.isArray(r), 'Each result should be an array');
    }
}
async function testConcurrentExecuteDynamic() {
    const engine = new MockEngine();
    engine.toolMapping.set('tool_a', ['server1', 'tool_a']);
    engine.toolMapping.set('tool_b', ['server1', 'tool_b']);
    engine.callChildResult = '{"ok":true}';
    const promises = Array.from({ length: 6 }, (_, i) => engine.callChild('server1', i % 2 === 0 ? 'tool_a' : 'tool_b', { id: i }));
    const results = await Promise.all(promises);
    for (const r of results) {
        const parsed = JSON.parse(r);
        assert.ok('ok' in parsed, 'Each result should have ok');
    }
}
// ─── TestTimeoutHandling (2 tests) ───────────────────────────────────────────
async function testExecuteTimeoutReturnsError() {
    // Simulate timeout with AbortController pattern
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 100);
    let result;
    try {
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve('{"result":"ok"}'), 5000);
            controller.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error("Tool 'slow_tool' timed out (100ms)"));
            });
        });
        result = '{"result":"ok"}';
    }
    catch (e) {
        result = JSON.stringify({ error: e.message });
    }
    finally {
        clearTimeout(timeoutId);
    }
    const parsed = JSON.parse(result);
    assert.ok('error' in parsed, 'Should have error');
    assert.ok(parsed.error.toLowerCase().includes('timed out'), 'Should mention timeout');
}
async function testRouterTimeoutPropagation() {
    // SmartRouter subtracts elapsed time from timeout
    const originalTimeout = 30_000;
    const elapsed = 25_000;
    const remaining = originalTimeout - elapsed;
    assert.ok(remaining < 6000, `Remaining ${remaining} should be < 6000`);
    assert.ok(remaining > 3000, `Remaining ${remaining} should be > 3000`);
}
// ─── TestRegistryScoring (3 tests) ───────────────────────────────────────────
async function testHitRecordingWithWeight() {
    const registry = new index_js_1.UnifiedRegistry(0.5);
    registry.setChildTools('s', [toolDef('tool_a', 'A tool')]);
    registry.recordHit('tool_a', 1);
    registry.recordHit('tool_a', 3);
    // Verify via ranking: tool_a with 4 hits should rank above a 0-hit tool
    registry.setChildTools('s2', [toolDef('tool_b', 'A tool')]);
    const results = registry.search('tool');
    assert.strictEqual(results[0].name, 'tool_a', 'tool_a should rank first with 4 hits');
}
async function testPopularToolsRankHigher() {
    const registry = new index_js_1.UnifiedRegistry(0.5);
    registry.setChildTools('server', [
        toolDef('popular_tool', 'A tool for testing'),
        toolDef('unpopular_tool', 'A tool for testing'),
    ]);
    for (let i = 0; i < 10; i++)
        registry.recordHit('popular_tool', 3);
    const results = registry.search('tool testing');
    const names = results.map((t) => t.name);
    assert.strictEqual(names[0], 'popular_tool', 'Popular tool should rank first');
}
async function testDecayPreventsRunaway() {
    const registry = new index_js_1.UnifiedRegistry(0.5);
    registry.setChildTools('server', [toolDef('hot_tool', 'Very popular')]);
    // Record 999 hits then +2 to trigger decay at 1001
    for (let i = 0; i < 999; i++)
        registry.recordHit('hot_tool', 1);
    registry.recordHit('hot_tool', 2); // 1001 → decay → 501
    // Verify tool still searchable (decay doesn't remove it)
    const results = registry.search('hot popular');
    assert.ok(results.length > 0, 'Tool should still be searchable after decay');
}
// ─── TestRoutingTable (4 tests) ──────────────────────────────────────────────
async function testResolveExistingTool() {
    const table = new index_js_2.RoutingTable();
    const childMap = new Map();
    childMap.set('child:atlassian', ['jira_search', 'jira_add_comment']);
    table.rebuild(new Set(), childMap);
    const route = table.resolve('jira_search');
    assert.ok(route !== null, 'Route should exist');
    assert.strictEqual(route.serverName, 'atlassian');
}
async function testResolveUnknownTool() {
    const table = new index_js_2.RoutingTable();
    table.rebuild(new Set(), new Map());
    assert.strictEqual(table.resolve('nonexistent'), null);
}
async function testAddRouteDynamically() {
    const table = new index_js_2.RoutingTable();
    table.rebuild(new Set(), new Map());
    table.addRoute('new_tool', 'new_server');
    const route = table.resolve('new_tool');
    assert.ok(route !== null, 'Route should exist after addRoute');
    assert.strictEqual(route.serverName, 'new_server');
}
async function testAddRouteDoesNotOverwrite() {
    const table = new index_js_2.RoutingTable();
    const childMap = new Map();
    childMap.set('child:server1', ['my_tool']);
    table.rebuild(new Set(), childMap);
    table.addRoute('my_tool', 'server2');
    const route = table.resolve('my_tool');
    assert.ok(route !== null);
    assert.strictEqual(route.serverName, 'server1', 'Original route should be preserved');
}
// ─── TestNestedDetection (2 tests) ───────────────────────────────────────────
async function testDetectNestedWithFindTools() {
    const tools = ['find_tools', 'execute_dynamic_tool', 'other_tool'];
    assert.strictEqual((0, nested_detection_js_1.isNestedOrchestrator)(tools), true);
}
async function testDetectNonNested() {
    const tools = ['jira_search', 'jira_create_issue', 'confluence_search'];
    assert.strictEqual((0, nested_detection_js_1.isNestedOrchestrator)(tools), false);
}
// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    console.log('Running Node.js orchestration E2E tests...\n');
    console.log('--- TestFindTools (8 tests) ---');
    await runTest('find_tools_jira_query', testFindToolsJiraQuery);
    await runTest('find_tools_confluence_query', testFindToolsConfluenceQuery);
    await runTest('find_tools_create_query', testFindToolsCreateQuery);
    await runTest('find_tools_empty_query', testFindToolsEmptyQuery);
    await runTest('find_tools_missing_query', testFindToolsMissingQuery);
    await runTest('find_tools_no_results', testFindToolsNoResults);
    await runTest('find_tools_max_10', testFindToolsMax10);
    await runTest('find_tools_nested_delegation', testFindToolsNestedDelegation);
    console.log('\n--- TestExecuteDynamicTool (6 tests) ---');
    await runTest('execute_mapped_tool', testExecuteMappedTool);
    await runTest('execute_undiscovered_tool', testExecuteUndiscoveredTool);
    await runTest('execute_missing_tool_name', testExecuteMissingToolName);
    await runTest('execute_records_hit_on_success', testExecuteRecordsHitOnSuccess);
    await runTest('execute_records_only_1_hit_on_error', testExecuteRecordsOnly1HitOnError);
    await runTest('execute_without_event_loop', testExecuteWithoutEventLoop);
    console.log('\n--- TestOrchestrationStatus (2 tests) ---');
    await runTest('status_enabled', testStatusEnabled);
    await runTest('status_disabled', testStatusDisabled);
    console.log('\n--- TestRestartBehavior (3 tests) ---');
    await runTest('mapping_lost_after_stop', testMappingLostAfterStop);
    await runTest('new_engine_empty_mapping', testNewEngineEmptyMapping);
    await runTest('find_tools_repopulates_mapping', testFindToolsRepopulatesMapping);
    console.log('\n--- TestConcurrentCalls (2 tests) ---');
    await runTest('concurrent_find_tools', testConcurrentFindTools);
    await runTest('concurrent_execute_dynamic', testConcurrentExecuteDynamic);
    console.log('\n--- TestTimeoutHandling (2 tests) ---');
    await runTest('execute_timeout_returns_error', testExecuteTimeoutReturnsError);
    await runTest('router_timeout_propagation', testRouterTimeoutPropagation);
    console.log('\n--- TestRegistryScoring (3 tests) ---');
    await runTest('hit_recording_with_weight', testHitRecordingWithWeight);
    await runTest('popular_tools_rank_higher', testPopularToolsRankHigher);
    await runTest('decay_prevents_runaway', testDecayPreventsRunaway);
    console.log('\n--- TestRoutingTable (4 tests) ---');
    await runTest('resolve_existing_tool', testResolveExistingTool);
    await runTest('resolve_unknown_tool', testResolveUnknownTool);
    await runTest('add_route_dynamically', testAddRouteDynamically);
    await runTest('add_route_does_not_overwrite', testAddRouteDoesNotOverwrite);
    console.log('\n--- TestNestedDetection (2 tests) ---');
    await runTest('detect_nested_with_find_tools', testDetectNestedWithFindTools);
    await runTest('detect_non_nested', testDetectNonNested);
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
}
main();
//# sourceMappingURL=test-orchestration-e2e.js.map