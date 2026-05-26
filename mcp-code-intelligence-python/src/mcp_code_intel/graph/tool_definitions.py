"""Graph tool definitions — MCP schemas for call graph, traverse, impact, dependencies. KSA-171."""

GRAPH_TOOL_DEFINITIONS = [
    {
        "name": "code_callers",
        "description": "Find all callers of a function/method with transitive depth control. Supports qualified names (Class.method) and file:symbol format.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": 'Symbol name to find callers for (e.g. "processData", "MyClass.method", "src/utils:helper")'},
                "depth": {"type": "number", "description": "Transitive depth (1-5, default 1)"},
                "limit": {"type": "number", "description": "Max results (default 20)"},
                "file_filter": {"type": "string", "description": "Filter results by file path pattern (glob)"},
                "kind_filter": {"type": "string", "description": "Relationship kind filter (default: calls)"},
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "code_callees",
        "description": "Find all functions/methods called by a given symbol with transitive depth.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Symbol name to find callees for"},
                "depth": {"type": "number", "description": "Transitive depth (1-5, default 1)"},
                "limit": {"type": "number", "description": "Max results (default 20)"},
                "file_filter": {"type": "string", "description": "Filter results by file path pattern (glob)"},
                "include_external": {"type": "boolean", "description": "Include external/unresolved callees (default true)"},
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "code_traverse",
        "description": "Generic graph traversal with custom edge/node type filters. Traverse the code relationship graph from any symbol with fine-grained control.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "start": {"type": "string", "description": 'Start symbol (e.g. "MyClass", "MyClass.method", "file.ts:func")'},
                "edge_types": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Filter by edge types: calls, imports, inherits, implements, uses, decorates (default: all)",
                },
                "node_types": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Filter by node types: function, class, interface, method, variable (default: all)",
                },
                "direction": {"type": "string", "enum": ["outgoing", "incoming", "both"], "description": "Traversal direction (default: outgoing)"},
                "max_depth": {"type": "number", "description": "Maximum traversal depth 1-10 (default: 3)"},
                "max_results": {"type": "number", "description": "Maximum results (default: 50)"},
                "include_source": {"type": "boolean", "description": "Include source code snippets (default: false)"},
                "source_lines": {"type": "number", "description": "Lines of source to include (default: 5)"},
            },
            "required": ["start"],
        },
    },
    {
        "name": "code_impact",
        "description": "Predict blast radius of modifying, deleting, or renaming a symbol. Shows affected callers, dependents, tests, and provides recommendations.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Symbol name to analyze impact for"},
                "action": {"type": "string", "enum": ["modify", "delete", "rename"], "description": "Type of change (default: modify)"},
                "depth": {"type": "number", "description": "Analysis depth 1-5 (default: 3)"},
                "include_tests": {"type": "boolean", "description": "Include affected test files (default: true)"},
                "severity_threshold": {"type": "string", "enum": ["critical", "high", "medium", "low"], "description": "Minimum severity to include (default: low)"},
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "code_dependencies",
        "description": "Analyze file/module import dependencies with direction and depth control. Shows what a file imports (outgoing) or what imports it (incoming).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "file": {"type": "string", "description": "File path to analyze (relative or absolute)"},
                "direction": {"type": "string", "enum": ["incoming", "outgoing", "both"], "description": "Direction of dependency analysis (default: outgoing)"},
                "depth": {"type": "number", "description": "Traversal depth 1-5 (default: 1)"},
                "include_external": {"type": "boolean", "description": "Include external/stdlib dependencies (default: false)"},
                "format": {"type": "string", "enum": ["tree", "flat", "graph"], "description": "Output format (default: tree)"},
                "limit": {"type": "number", "description": "Max results (default: 50)"},
            },
            "required": ["file"],
        },
    },
]
