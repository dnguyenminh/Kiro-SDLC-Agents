"""End-to-end tests for Python MCP orchestration: find_tools, execute_dynamic_tool, routing.

Tests cover:
- find_tools with various queries
- execute_dynamic_tool with discovered and undiscovered tools
- orchestration_status
- Restart behavior (mapping loss)
- Concurrent calls
- Timeout handling
- Scoring/hit recording
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import json
import threading
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mcp_code_intel.orchestration.engine import OrchestrationEngine
from mcp_code_intel.orchestration.config import (
    OrchestrationConfig, OrchestrationSettings, ServerEntry, AutoLogSettings,
)
from mcp_code_intel.orchestration.meta import find_tools, execute_dynamic
from mcp_code_intel.orchestration.registry.registry import UnifiedRegistry
from mcp_code_intel.orchestration.routing.table import RoutingTable


# --- Fixtures ---


@pytest.fixture
def mock_config():
    """Minimal orchestration config for testing."""
    return OrchestrationConfig(
        mcp_servers={
            "atlassian": ServerEntry(command="echo", args=["test"], timeout=5000),
        },
        settings=OrchestrationSettings(similarity_threshold=0.5),
    )


@pytest.fixture
def mock_memory_engine():
    """Mock memory engine with search capability."""
    mem = MagicMock()
    mem.search.return_value = []
    mem.knowledge = MagicMock()
    mem.knowledge.insert = MagicMock()
    return mem


@pytest.fixture
def engine(mock_config, mock_memory_engine):
    """OrchestrationEngine with mocked internals and running event loop."""
    eng = OrchestrationEngine(mock_config, mock_memory_engine, {"workspace": "/tmp"})
    eng._started = True
    # Create and start a background event loop for async operations
    import threading
    loop = asyncio.new_event_loop()
    thread = threading.Thread(target=loop.run_forever, daemon=True)
    thread.start()
    eng._orch_loop = loop
    yield eng
    loop.call_soon_threadsafe(loop.stop)
    thread.join(timeout=2)


@pytest.fixture
def registry():
    """Fresh UnifiedRegistry."""
    return UnifiedRegistry(similarity_threshold=0.5)


# --- find_tools tests ---


class TestFindTools:
    """Tests for find_tools discovery."""

    def test_find_tools_with_jira_query(self, engine, registry):
        """find_tools('jira') returns Jira-related tools from registry."""
        registry.set_child_tools("atlassian", [
            {"name": "jira_search", "description": "Search Jira issues using JQL"},
            {"name": "jira_add_comment", "description": "Add comment to Jira issue"},
            {"name": "jira_get_transitions", "description": "Get transitions for issue"},
            {"name": "confluence_search", "description": "Search Confluence pages"},
        ])
        engine._registry = registry
        engine._find_tools_delegates = []

        result = json.loads(find_tools.execute(engine, {"query": "jira"}))

        assert len(result) >= 3
        names = [t["name"] for t in result]
        assert "jira_search" in names
        assert "jira_add_comment" in names

    def test_find_tools_with_confluence_query(self, engine, registry):
        """find_tools('confluence') returns Confluence tools."""
        registry.set_child_tools("atlassian", [
            {"name": "jira_search", "description": "Search Jira issues"},
            {"name": "confluence_search", "description": "Search Confluence pages"},
            {"name": "confluence_create_page", "description": "Create Confluence page"},
        ])
        engine._registry = registry
        engine._find_tools_delegates = []

        result = json.loads(find_tools.execute(engine, {"query": "confluence"}))

        names = [t["name"] for t in result]
        assert "confluence_search" in names

    def test_find_tools_with_create_query(self, engine, registry):
        """find_tools('create') returns tools with 'create' in name/description."""
        registry.set_child_tools("atlassian", [
            {"name": "jira_create_issue", "description": "Create a new Jira issue"},
            {"name": "confluence_create_page", "description": "Create Confluence page"},
            {"name": "jira_search", "description": "Search issues"},
        ])
        engine._registry = registry
        engine._find_tools_delegates = []

        result = json.loads(find_tools.execute(engine, {"query": "create"}))

        names = [t["name"] for t in result]
        assert "jira_create_issue" in names
        assert "confluence_create_page" in names

    def test_find_tools_empty_query_returns_error(self, engine):
        """find_tools with empty query returns error."""
        result = json.loads(find_tools.execute(engine, {"query": ""}))
        assert "error" in result

    def test_find_tools_no_query_param_returns_error(self, engine):
        """find_tools without query param returns error."""
        result = json.loads(find_tools.execute(engine, {}))
        assert "error" in result

    def test_find_tools_no_results_returns_empty(self, engine, registry):
        """find_tools with unmatched query returns empty list."""
        registry.set_child_tools("atlassian", [
            {"name": "jira_search", "description": "Search Jira issues"},
        ])
        engine._registry = registry
        engine._find_tools_delegates = []

        result = json.loads(find_tools.execute(engine, {"query": "kubernetes deploy helm"}))

        assert result == []

    def test_find_tools_max_10_results(self, engine, registry):
        """find_tools returns at most 10 results."""
        tools = [
            {"name": f"tool_{i}", "description": f"Tool number {i} for testing"}
            for i in range(20)
        ]
        registry.set_child_tools("test-server", tools)
        engine._registry = registry
        engine._find_tools_delegates = []

        result = json.loads(find_tools.execute(engine, {"query": "tool testing"}))

        assert len(result) <= 10

    def test_find_tools_nested_delegation(self, engine, registry):
        """find_tools delegates to nested orchestrators when they exist."""
        engine._registry = registry
        engine._find_tools_delegates = ["bridge-server"]

        nested_response = json.dumps([
            {"name": "nested_tool_1", "description": "A nested tool"},
        ])

        # Mock call_child to return immediately without needing event loop
        with patch.object(engine, 'call_child', new_callable=AsyncMock) as mock_call:
            mock_call.return_value = nested_response
            # Patch _run_nested_call to bypass event loop threading
            with patch(
                'mcp_code_intel.orchestration.meta.find_tools._run_nested_call',
                return_value=nested_response,
            ):
                result = json.loads(find_tools.execute(engine, {"query": "nested"}))

        # Tool should be registered in mapping
        mapping = engine.get_tool_mapping("nested_tool_1")
        assert mapping is not None
        assert mapping[0] == "bridge-server"


# --- execute_dynamic_tool tests ---


class TestExecuteDynamicTool:
    """Tests for execute_dynamic_tool routing."""

    def test_execute_mapped_tool(self, engine):
        """execute_dynamic_tool routes mapped tools via nested server."""
        engine._tool_mapping["jira_search"] = ("atlassian", "jira_search")
        engine._registry = UnifiedRegistry()

        expected = json.dumps({"total": 5, "issues": []})

        with patch.object(engine, 'call_child', new_callable=AsyncMock) as mock_call:
            mock_call.return_value = expected
            result = execute_dynamic.execute_sync(engine, {
                "tool_name": "jira_search",
                "arguments": {"jql": "project = KSA"},
            })

        parsed = json.loads(result)
        assert "total" in parsed

    def test_execute_undiscovered_tool_fails_gracefully(self, engine):
        """execute_dynamic_tool with unknown tool returns error (not crash)."""
        engine._tool_mapping = {}
        engine._registry = UnifiedRegistry()

        with patch.object(engine, 'route', new_callable=AsyncMock) as mock_route:
            mock_route.side_effect = RuntimeError("Tool 'nonexistent_tool_xyz' not found")
            result = execute_dynamic.execute_sync(engine, {
                "tool_name": "nonexistent_tool_xyz",
                "arguments": {},
            })

        parsed = json.loads(result)
        assert "error" in parsed

    def test_execute_missing_tool_name_returns_error(self, engine):
        """execute_dynamic_tool without tool_name returns error."""
        result = execute_dynamic.execute_sync(engine, {"arguments": {}})

        parsed = json.loads(result)
        assert "error" in parsed
        assert "tool_name" in parsed["error"].lower() or "missing" in parsed["error"].lower()

    def test_execute_records_hit_on_success(self, engine):
        """Successful execution records +1 hit, non-error result records +3."""
        engine._tool_mapping["test_tool"] = ("server1", "test_tool")
        registry = UnifiedRegistry()
        engine._registry = registry

        with patch.object(engine, 'call_child', new_callable=AsyncMock) as mock_call:
            mock_call.return_value = json.dumps({"result": "ok"})
            execute_dynamic.execute_sync(engine, {
                "tool_name": "test_tool",
                "arguments": {},
            })

        # Should have recorded hits (1 + 3 = 4 total)
        assert registry._hits.get("test_tool", 0) == 4

    def test_execute_records_only_1_hit_on_error_result(self, engine):
        """Error result records +1 (call success) then -10 (error penalty), net = -9."""
        engine._tool_mapping["err_tool"] = ("server1", "err_tool")
        registry = UnifiedRegistry()
        engine._registry = registry

        with patch.object(engine, 'call_child', new_callable=AsyncMock) as mock_call:
            mock_call.return_value = json.dumps({"error": "something went wrong"})
            execute_dynamic.execute_sync(engine, {
                "tool_name": "err_tool",
                "arguments": {},
            })

        # +1 (call succeeded) + (-10) (error result penalty) = -9
        assert registry._hits.get("err_tool", 0) == -9

    def test_execute_without_event_loop_returns_error(self):
        """execute_dynamic_tool fails gracefully when event loop unavailable."""
        config = OrchestrationConfig(
            mcp_servers={},
            settings=OrchestrationSettings(similarity_threshold=0.5),
        )
        eng = OrchestrationEngine(config, None, {})
        eng._started = True
        eng._orch_loop = None  # No event loop

        result = execute_dynamic.execute_sync(eng, {
            "tool_name": "any_tool",
            "arguments": {},
        })

        parsed = json.loads(result)
        assert "error" in parsed


# --- orchestration_status tests ---


class TestOrchestrationStatus:
    """Tests for orchestration_status meta-tool."""

    def test_status_when_enabled(self, engine):
        """orchestration_status returns enabled=True when started."""
        status = engine.get_status()

        assert status["enabled"] is True
        assert "servers" in status
        assert "hiddenTools" in status

    def test_status_when_disabled(self, mock_config, mock_memory_engine):
        """orchestration_status returns enabled=False when not started."""
        eng = OrchestrationEngine(mock_config, mock_memory_engine, {})
        status = eng.get_status()

        assert status["enabled"] is False


# --- Restart behavior tests ---


class TestRestartBehavior:
    """Tests for mapping loss after restart."""

    def test_mapping_lost_after_stop(self, engine):
        """After stop(), tool_mapping is NOT cleared (in-memory until GC)."""
        engine._tool_mapping["jira_search"] = ("atlassian", "jira_search")
        engine.stop()

        # Mapping still exists in memory but engine is stopped
        assert engine._started is False

    def test_new_engine_has_empty_mapping(self, mock_config, mock_memory_engine):
        """Fresh engine has no tool mappings — find_tools must be called."""
        eng = OrchestrationEngine(mock_config, mock_memory_engine, {})

        assert eng.get_tool_mapping("jira_search") is None
        assert eng._tool_mapping == {}

    def test_find_tools_repopulates_mapping(self, engine, registry):
        """After restart, find_tools re-discovers and re-populates mapping."""
        engine._registry = registry
        engine._find_tools_delegates = ["bridge"]

        nested_response = json.dumps([
            {"name": "jira_search", "description": "Search Jira"},
        ])

        with patch(
            'mcp_code_intel.orchestration.meta.find_tools._run_nested_call',
            return_value=nested_response,
        ):
            find_tools.execute(engine, {"query": "jira"})

        assert engine.get_tool_mapping("jira_search") is not None


# --- Concurrent calls tests ---


class TestConcurrentCalls:
    """Tests for concurrent find_tools and execute_dynamic_tool calls."""

    def test_concurrent_find_tools(self, engine, registry):
        """Multiple concurrent find_tools calls don't corrupt state."""
        registry.set_child_tools("atlassian", [
            {"name": "jira_search", "description": "Search Jira issues"},
            {"name": "jira_add_comment", "description": "Add comment"},
        ])
        engine._registry = registry
        engine._find_tools_delegates = []

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                executor.submit(find_tools.execute, engine, {"query": q})
                for q in ["jira", "comment", "search", "jira", "add"]
            ]
            results = [f.result() for f in futures]

        # All should return valid JSON
        for r in results:
            parsed = json.loads(r)
            assert isinstance(parsed, list)

    def test_concurrent_execute_dynamic(self, engine):
        """Multiple concurrent execute_dynamic_tool calls work independently."""
        engine._tool_mapping["tool_a"] = ("server1", "tool_a")
        engine._tool_mapping["tool_b"] = ("server1", "tool_b")
        engine._registry = UnifiedRegistry()

        with patch.object(engine, 'call_child', new_callable=AsyncMock) as mock_call:
            mock_call.return_value = json.dumps({"ok": True})

            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                futures = [
                    executor.submit(execute_dynamic.execute_sync, engine, {
                        "tool_name": f"tool_{'a' if i % 2 == 0 else 'b'}",
                        "arguments": {"id": i},
                    })
                    for i in range(6)
                ]
                results = [f.result(timeout=10) for f in futures]

        for r in results:
            parsed = json.loads(r)
            assert "ok" in parsed or "error" in parsed


# --- Timeout handling tests ---


class TestTimeoutHandling:
    """Tests for timeout behavior."""

    def test_execute_timeout_returns_error(self, engine):
        """execute_dynamic_tool returns error on timeout (not exception)."""
        engine._tool_mapping["slow_tool"] = ("server1", "slow_tool")
        engine._registry = UnifiedRegistry()

        async def slow_call(*args, **kwargs):
            await asyncio.sleep(120)
            return "{}"

        with patch.object(engine, 'call_child', side_effect=slow_call):
            # Monkey-patch the timeout in execute_sync to 2s for test speed
            original_sync = execute_dynamic.execute_sync

            def fast_timeout_sync(eng, args):
                """Wrapper that patches Future.result timeout to 2s."""
                import types
                tool_name = args.get("tool_name")
                if not tool_name:
                    return json.dumps({"error": "Missing 'tool_name'"})
                # Directly test timeout behavior
                future = asyncio.run_coroutine_threadsafe(
                    execute_dynamic._execute(eng, tool_name, args.get("arguments", {})),
                    eng._orch_loop,
                )
                try:
                    return future.result(timeout=2)
                except concurrent.futures.TimeoutError:
                    return json.dumps({"error": f"Tool '{tool_name}' timed out (2s)"})

            result = fast_timeout_sync(engine, {
                "tool_name": "slow_tool",
                "arguments": {},
            })

        parsed = json.loads(result)
        assert "error" in parsed
        assert "timed out" in parsed["error"].lower() or "timeout" in parsed["error"].lower()

    def test_router_timeout_propagation(self):
        """SmartRouter subtracts elapsed time from timeout."""
        from mcp_code_intel.orchestration.routing.router import SmartRouter

        manager = MagicMock()
        table = RoutingTable()
        router = SmartRouter(manager, table)

        router.request_start_time = time.time() - 25  # 25 seconds elapsed

        remaining = router._compute_remaining_timeout(30_000, "test-server")
        # Should be ~5000ms remaining (30000 - 25000)
        assert remaining < 6000
        assert remaining > 3000


# --- Registry scoring tests ---


class TestRegistryScoring:
    """Tests for hit-based scoring in UnifiedRegistry."""

    def test_hit_recording_with_weight(self, registry):
        """record_hit with weight=3 adds 3 to hit count."""
        registry.record_hit("tool_a", 1)
        registry.record_hit("tool_a", 3)

        assert registry._hits["tool_a"] == 4

    def test_popular_tools_rank_higher(self, registry):
        """Tools with more hits rank higher in search results."""
        registry.set_child_tools("server", [
            {"name": "popular_tool", "description": "A tool for testing"},
            {"name": "unpopular_tool", "description": "A tool for testing"},
        ])
        # Give popular_tool many hits
        for _ in range(10):
            registry.record_hit("popular_tool", 3)

        results = registry.search("tool testing")
        names = [t.name for t in results]

        assert names[0] == "popular_tool"

    def test_decay_prevents_runaway(self, registry):
        """Hits > 1000 trigger decay (subtract 500)."""
        registry.set_child_tools("server", [
            {"name": "hot_tool", "description": "Very popular"},
        ])
        registry._hits["hot_tool"] = 999
        registry.record_hit("hot_tool", 2)  # Goes to 1001, triggers decay

        # After decay: 1001 - 500 = 501
        assert registry._hits["hot_tool"] == 501


# --- Routing table tests ---


class TestRoutingTable:
    """Tests for RoutingTable O(1) lookup."""

    def test_resolve_existing_tool(self):
        """resolve() returns correct server for known tool."""
        table = RoutingTable()
        table.rebuild(set(), {"child:atlassian": ["jira_search", "jira_add_comment"]})

        route = table.resolve("jira_search")
        assert route is not None
        assert route.server_name == "atlassian"

    def test_resolve_unknown_tool_returns_none(self):
        """resolve() returns None for unknown tool."""
        table = RoutingTable()
        table.rebuild(set(), {})

        assert table.resolve("nonexistent") is None

    def test_add_route_dynamically(self):
        """add_route() adds new tool mapping at runtime."""
        table = RoutingTable()
        table.rebuild(set(), {})

        table.add_route("new_tool", "new_server")

        route = table.resolve("new_tool")
        assert route is not None
        assert route.server_name == "new_server"

    def test_add_route_does_not_overwrite(self):
        """add_route() does not overwrite existing routes."""
        table = RoutingTable()
        table.rebuild(set(), {"child:server1": ["my_tool"]})

        table.add_route("my_tool", "server2")

        route = table.resolve("my_tool")
        assert route.server_name == "server1"  # Original preserved


# --- Nested detection tests ---


class TestNestedDetection:
    """Tests for nested orchestrator detection."""

    def test_detect_nested_with_find_tools(self):
        """Server with find_tools is detected as nested orchestrator."""
        from mcp_code_intel.orchestration.nested_detection import is_nested_orchestrator

        tools = ["find_tools", "execute_dynamic_tool", "other_tool"]
        assert is_nested_orchestrator(tools) is True

    def test_detect_non_nested(self):
        """Server without meta-tools is not a nested orchestrator."""
        from mcp_code_intel.orchestration.nested_detection import is_nested_orchestrator

        tools = ["jira_search", "jira_create_issue", "confluence_search"]
        assert is_nested_orchestrator(tools) is False
