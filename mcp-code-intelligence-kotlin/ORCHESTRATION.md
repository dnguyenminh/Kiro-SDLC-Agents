# MCP Orchestration Proxy

Recursive stdio-based orchestration that spawns and manages child MCP servers as sub-processes.

## Quick Start

```bash
# Run with orchestration config
java -jar mcp-code-intelligence-kotlin.jar --config ./orchestration.conf

# With explicit depth control
java -jar mcp-code-intelligence-kotlin.jar --config ./orchestration.conf --max-depth 3
```

Without `--config`, the server runs standalone (no orchestration).

## CLI Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--config <path>` | none | Path to orchestration config file |
| `--workspace <path>` | cwd | Workspace root for code intelligence |
| `--depth <N>` | 0 | Current recursion depth (auto-incremented for children) |
| `--max-depth <N>` | 5 | Maximum recursion depth |
| `--viewer-port <N>` | 3200 | HTTP viewer port |

## Config File Format

JSON file defining child MCP servers to spawn:

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": { "JIRA_URL": "https://myorg.atlassian.net" },
      "disabled": false,
      "timeout": 30000
    },
    "export-tools": {
      "command": "python",
      "args": ["-m", "export_mcp"],
      "env": {},
      "timeout": 15000
    }
  },
  "settings": {
    "autoLog": {
      "enabled": true,
      "excludeTools": ["mem_audit", "mem_status"],
      "maxArgLength": 200
    },
    "healthCheckIntervalMs": 30000,
    "maxRestartRetries": 3
  }
}
```

### Server Entry Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `command` | string | required | Executable to run |
| `args` | string[] | [] | Command-line arguments |
| `env` | object | {} | Environment variables |
| `disabled` | boolean | false | Skip this server |
| `timeout` | long | 30000 | Request timeout (ms) |

### Settings Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `autoLog.enabled` | boolean | true | Log proxied calls to audit |
| `autoLog.excludeTools` | string[] | [] | Tools to skip logging |
| `autoLog.maxArgLength` | int | 200 | Truncate args in logs |
| `healthCheckIntervalMs` | long | 30000 | Health check interval |
| `maxRestartRetries` | int | 3 | Max restart attempts |

## Example Configs

### Single Level — Jira + Export

```json
{
  "mcpServers": {
    "jira-mcp": {
      "command": "node",
      "args": ["C:/tools/jira-mcp/dist/index.js"],
      "env": {
        "JIRA_URL": "https://myorg.atlassian.net",
        "JIRA_EMAIL": "user@example.com",
        "JIRA_API_TOKEN": "token-here"
      }
    },
    "docx-export": {
      "command": "python",
      "args": ["-m", "docx_export_mcp"],
      "env": { "OUTPUT_DIR": "./documents" }
    }
  }
}
```

### Recursive — Orchestrator spawning another orchestrator

```json
{
  "mcpServers": {
    "sub-orchestrator": {
      "command": "java",
      "args": ["-jar", "mcp-code-intelligence-kotlin.jar", "--config", "./sub-orch.conf"],
      "timeout": 60000
    },
    "local-tools": {
      "command": "node",
      "args": ["./local-mcp/index.js"]
    }
  },
  "settings": {
    "healthCheckIntervalMs": 15000
  }
}
```

Depth auto-increments: parent at depth 0 spawns child at depth 1.

## Meta-Tools

When orchestration is active, these tools are available:

| Tool | Description |
|------|-------------|
| `find_tools` | Fuzzy search tools by description |
| `execute_dynamic_tool` | Execute any tool by exact name |
| `toggle_tool` | Enable/disable a tool for this session |
| `reset_tools` | Reset all toggles to default |
| `manage_auto_approve` | Persist auto-approve list |
| `orchestration_status` | Show servers, metrics, depth, config |
| `agent_log` | Log agent activity to jsonl file |

## Architecture

```
Parent Process (depth=0)
├── StdioJsonRpc ←→ Child "jira" (node process)
├── StdioJsonRpc ←→ Child "export" (python process)
└── StdioJsonRpc ←→ Child "sub-orch" (java, depth=1)
                     ├── StdioJsonRpc ←→ Grandchild A
                     └── StdioJsonRpc ←→ Grandchild B
```

### Tool Resolution Priority

1. Memory tools (`mem_*`) — handled by MemoryToolDispatcher
2. Native tools (`code_*`) — handled by ToolDispatcher
3. Meta-tools (`find_tools`, etc.) — handled by MetaToolDispatcher
4. Child server tools — routed via SmartRouter

### Process Lifecycle

Each child server goes through: STARTING → READY → ACTIVE → (CRASHED → RESTARTING) → DEAD

- Health checks run every `healthCheckIntervalMs`
- Crashed servers auto-restart up to `maxRestartRetries` times
- On Windows, `taskkill /T /F /PID` kills entire process tree

### Config Hot-Reload

Modify the config file while running — changes are detected via Java WatchService:
- New servers are spawned
- Removed servers are stopped
- Modified servers are restarted

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Max depth" log, no children | Depth limit reached | Increase `--max-depth` |
| Server stays FAILED | Command not found or crashes on start | Check `command` path and args |
| Timeout errors | Child too slow or deadlocked | Increase `timeout` in config |
| Tools not appearing | Server disabled or crashed | Check `orchestration_status` |
| Health check failures | Child process hung | Will auto-restart up to max retries |
