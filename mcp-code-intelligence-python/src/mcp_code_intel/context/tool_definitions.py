"""Context tool definitions — MCP schemas for AI context, edit context, curated context. KSA-171."""

CONTEXT_TOOL_DEFINITIONS = [
    {
        "name": "get_ai_context",
        "description": "Get intent-aware code context with token budgeting. Returns source, callers, callees, tests based on intent (explain/modify/debug/test).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Symbol name to get context for (supports Class.method, file:symbol formats)"},
                "intent": {"type": "string", "description": "Intent: explain, modify, debug, test (default: explain)", "enum": ["explain", "modify", "debug", "test"]},
                "token_budget": {"type": "number", "description": "Max tokens for response (default: 4000, min: 500)"},
                "caller_depth": {"type": "number", "description": "Depth for caller/callee traversal (default: 1, max: 5)"},
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "get_edit_context",
        "description": "Get everything needed before editing a symbol: source + callers + tests + git history + siblings. Optimized for code modification.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Symbol name or file:line format"},
                "include_callers": {"type": "boolean", "description": "Include caller context (default: true)"},
                "include_tests": {"type": "boolean", "description": "Include related test context (default: true)"},
                "include_git": {"type": "boolean", "description": "Include git history (default: true)"},
                "token_budget": {"type": "number", "description": "Max tokens (default: 4000)"},
                "caller_depth": {"type": "number", "description": "Caller traversal depth (default: 1)"},
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "get_curated_context",
        "description": "Natural language query across codebase: searches code symbols, knowledge base, and graph relationships. Returns ranked results within token budget.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": 'Natural language query (e.g., "how does authentication work")'},
                "max_tokens": {"type": "number", "description": "Max tokens for response (default: 4000)"},
                "include_source": {"type": "boolean", "description": "Search code symbols (default: true)"},
                "include_memory": {"type": "boolean", "description": "Search knowledge base (default: true)"},
                "include_graph": {"type": "boolean", "description": "Expand via graph relationships (default: true)"},
                "source_weights": {
                    "type": "object",
                    "description": "Custom weights for source ranking",
                    "properties": {
                        "code": {"type": "number"},
                        "memory": {"type": "number"},
                        "graph": {"type": "number"},
                    },
                },
            },
            "required": ["query"],
        },
    },
]
