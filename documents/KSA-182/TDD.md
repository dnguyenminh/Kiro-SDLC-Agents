# Technical Design Document (TDD)

## Code Intelligence MCP — KSA-182: httpStream Transport Support

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-182 |
| Title | [Bug] httpStream Transport Not Supported |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-182.docx |
| Related BRD | BRD-v1-KSA-182.docx |

---

## 1. Architecture Overview

### 1.1 Current State (Broken)

![Architecture — Current State](diagrams/architecture-current.png)

*[Edit in draw.io](diagrams/architecture-current.drawio)*

**Root Cause:** `ServerEntry` interface only has `command`/`args` fields. Config parser ignores `url`/`transportType`. `ServerProcess` always spawns a child process.

### 1.2 Target State (Fixed)

![Architecture — Target State](diagrams/architecture-target.png)

*[Edit in draw.io](diagrams/architecture-target.drawio)*

### 1.3 Design Principles

1. **Strategy Pattern** — `IServerProcess` interface, two implementations
2. **Backward Compatible** — existing stdio configs work unchanged
3. **Minimal Changes** — modify only what's necessary, keep existing code stable
4. **Same State Machine** — both transports use same `ServerState` enum

---

## 2. Detailed Design

### 2.1 Config Changes (`config.ts`)

**Modified Interface:**

```typescript
export type TransportType = 'stdio' | 'httpStream';

export interface ServerEntry {
  // Stdio fields (existing)
  command?: string;
  args: string[];
  env: Record<string, string>;
  // httpStream fields (new)
  url?: string;
  transportType?: TransportType;
  // Common fields
  disabled: boolean;
  timeout: number;
  autoApprove: string[];
}
```

**Modified `parseConfig()`:**

```typescript
servers[name] = {
  command: e.command,
  args: e.args ?? [],
  env: e.env ?? {},
  url: e.url,                          // NEW
  transportType: e.transportType,      // NEW
  disabled: e.disabled ?? false,
  timeout: e.timeout ?? 30_000,
  autoApprove: e.autoApprove ?? [],
};
```

### 2.2 Transport Detection (`transport.ts` — NEW)

```typescript
export function detectTransport(entry: ServerEntry): TransportType {
  if (entry.url && !entry.command) return 'httpStream';
  if (entry.command && !entry.url) return 'stdio';
  if (entry.url && entry.command) return entry.transportType === 'stdio' ? 'stdio' : 'httpStream';
  return 'stdio'; // fallback
}
```

### 2.3 Server Process Interface (`IServerProcess`)

Extract interface from existing `ServerProcess`:

```typescript
export interface IServerProcess {
  readonly name: string;
  state: ServerState;
  tools: Record<string, any>[];
  retryCount: number;
  start(): Promise<boolean>;
  stop(): void;
  restart(maxRetries: number): Promise<boolean>;
  callTool(toolName: string, args: Record<string, any>, timeoutMs: number): Promise<any>;
  healthCheck(): Promise<boolean>;
  isAlive(): boolean;
}
```

### 2.4 HttpJsonRpc (`http-json-rpc.ts` — NEW)

JSON-RPC 2.0 over HTTP POST. Replaces `StdioJsonRpc` for httpStream transport.

Key behaviors:
- Uses native `fetch()` (Node.js 18+)
- Manages `Mcp-Session-Id` header automatically
- Handles both JSON and SSE response formats
- AbortController for timeout

### 2.5 HttpStreamProcess (`http-stream-process.ts` — NEW)

Same state machine as `ServerProcess`, but uses HTTP instead of spawn.

Key differences from `ServerProcess`:
- No `spawn()` — connects via HTTP
- No `proc` field — no OS process
- `isAlive()` returns `state === ACTIVE` (no process to check)
- `stop()` just marks DEAD (no process to kill)
- `restart()` re-creates HTTP client and re-initializes

### 2.6 LocalServerManager Changes

**Only change in `startAll()`:** Use `detectTransport()` to create the right process type.

```typescript
// Before:
const server = new ServerProcess(name, entry);

// After:
import { detectTransport } from './transport.js';
import { HttpStreamProcess } from './http-stream-process.js';

const server = detectTransport(entry) === 'httpStream'
  ? new HttpStreamProcess(name, entry)
  : new ServerProcess(name, entry);
```

Health check works polymorphically — `isAlive()` and `healthCheck()` are on the interface.

---

## 3. File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `orchestration/config.ts` | MODIFY | Add `url`, `transportType` to `ServerEntry`; parse them |
| `orchestration/local/transport.ts` | NEW | `detectTransport()` function + `IServerProcess` interface |
| `orchestration/local/http-json-rpc.ts` | NEW | HTTP-based JSON-RPC client |
| `orchestration/local/http-stream-process.ts` | NEW | `HttpStreamProcess` class |
| `orchestration/local/process.ts` | MODIFY | Implement `IServerProcess` interface |
| `orchestration/local/manager.ts` | MODIFY | Use `detectTransport()` in `startAll()` + health check |
| `orchestration/local/index.ts` | MODIFY | Export new modules |

---

## 4. Error Handling

| Scenario | Behavior |
|----------|----------|
| URL unreachable | `state = FAILED`, log `"[name] not reachable at {url}"` |
| HTTP timeout | `state = FAILED`, log timeout |
| HTTP 4xx/5xx | `state = FAILED`, log status code |
| Invalid JSON response | `state = FAILED`, log parse error |
| JSON-RPC error | Forward error to caller |
| Server goes down mid-session | Health check detects → restart |

---

## 5. Implementation Checklist

- [ ] Modify `ServerEntry` interface — add `url?`, `transportType?`
- [ ] Modify `parseConfig()` — extract `url`, `transportType`
- [ ] Create `transport.ts` — `detectTransport()` + `IServerProcess` interface
- [ ] Create `http-json-rpc.ts` — HTTP JSON-RPC client
- [ ] Create `http-stream-process.ts` — `HttpStreamProcess` class
- [ ] Modify `ServerProcess` — implement `IServerProcess`
- [ ] Modify `LocalServerManager.startAll()` — transport detection
- [ ] Update `local/index.ts` exports
- [ ] Test: stdio servers still work (no regression)
- [ ] Test: httpStream server connects and fetches tools

---

## 6. Security Considerations

- No auth for localhost (current scope)
- Session IDs not logged (confidential)
- Tool arguments truncated in logs (existing behavior)
- URL validation before HTTP requests

---

## 7. Testing Strategy

| Level | What | How |
|-------|------|-----|
| Unit | `detectTransport()` | Direct function call with various configs |
| Unit | `HttpJsonRpc` | Mock fetch, verify request format |
| Integration | Full startup | Real httpStream server at localhost:3003 |
| Regression | Stdio servers | Existing configs still work |
