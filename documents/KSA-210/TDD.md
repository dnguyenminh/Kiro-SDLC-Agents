# Technical Design Document (TDD)

## Kiro SDLC Agents — KSA-210: LangGraph.js Integration with Chat Panel

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-210 |
| Title | LangGraph.js Integration with Chat Panel |
| Author | SA Agent |
| Version | 1 |
| Date | 2025-01-27 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-210.docx |
| Related FSD | FSD-v1-KSA-210.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | SA Agent | Initial technical design |

---

## 1. Introduction

### 1.1 Purpose

This document defines the technical architecture, module design, API contracts, and implementation plan for integrating LangGraph.js StateGraph orchestration and a Chat Panel WebviewView into the `kiro-sdlc-agents` VS Code extension (v1.16.0).

### 1.2 Scope

- **LangGraph.js Module** (`src/langgraph/`): StateGraph construction, typed nodes, conditional edges, checkpoint persistence, stream handling
- **Chat Panel Module** (`src/chat-panel/`): WebviewViewProvider, postMessage protocol, streaming renderer
- **Webview Assets** (`webview-assets/chat/`): HTML/CSS/JS for the sidebar chat UI, graph visualization, approval cards
- **Extension Integration**: Registration in `extension.ts`, esbuild bundling, dependency management

### 1.3 Technology Stack

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| Runtime | Node.js | ≥18 | LangGraph.js requirement; already extension host target |
| Language | TypeScript | 5.4+ | Existing project language |
| Framework | VS Code Extension API | 1.85+ | Existing engine constraint |
| Orchestration | @langchain/langgraph | 0.2.x | Core feature — StateGraph + checkpointing |
| Core LLM Types | @langchain/core | 0.3.x | Required peer dependency |
| Bundler | esbuild | 0.21+ | Existing bundler — tree-shaking critical |
| Webview UI | Vanilla HTML/CSS/JS | N/A | Lightweight, CSP-compatible, no framework |
| MCP Communication | HTTP (fetch) | N/A | Existing pattern via McpServerManager |

### 1.4 Design Principles

1. **Coexistence**: LangGraph orchestration coexists with existing MCP orchestration engine — no modifications to MCP server
2. **Lazy Initialization**: LangGraph module loaded on first use, not at extension activation (BR-11: ≤500ms impact)
3. **Existing Patterns**: Follow BasePanel CSP pattern, types.ts conventions, esbuild bundling approach
4. **JSON-Safe State**: All persistent state must be plain JSON — no functions, Date objects, circular references (BR-03)
5. **Separation of Concerns**: Each node in separate file; webview communicates only via postMessage

### 1.5 Constraints

- Bundle size budget: LangGraph adds ≤500KB to extension output (tree-shaken)
- Chat Panel must function at 250px minimum width
- No external network connections from webview (CSP: `connect-src 'none'`)
- Maximum 200 messages in chat history, 50 agent outputs in state

---

## 2. System Architecture

### 2.1 Architecture Overview

![Architecture](diagrams/architecture.png)
*[Edit in draw.io](diagrams/architecture.drawio)*

The system adds two major modules to the existing `kiro-sdlc-agents` extension:

1. **LangGraph Engine** (`src/langgraph/`) — Constructs and executes a StateGraph. Each node wraps MCP tool calls via the existing `McpServerManager.invokeTool()`. The engine emits streaming events during execution.

2. **Chat Panel** (`src/chat-panel/` + `webview-assets/chat/`) — A `WebviewViewProvider` registered in the VS Code sidebar. It receives user input, forwards to LangGraph, and renders streaming responses + graph visualization + approval cards.

**Data Flow:**

```
Developer ←→ Chat Panel (WebviewView)
                 ↕ postMessage
         Extension Host
         ├── ChatPanelProvider (message routing)
         ├── LangGraphEngine (StateGraph execution)
         │     ├── SM Node → MCP invokeTool()
         │     ├── BA Node → MCP invokeTool()
         │     ├── SA Node → MCP invokeTool()
         │     ├── QA/DEV/DevOps Nodes → MCP invokeTool()
         │     └── Approval Node (HITL pause)
         ├── WorkspaceCheckpointer → .vscode/kiro-pipeline-state/
         └── StreamHandler (event → postMessage adapter)
                 ↕ HTTP (JSON-RPC)
         MCP Server (port 9181)
         ├── Orchestration Engine
         ├── Memory/KB
         └── Tool Registry
```

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)
*[Edit in draw.io](diagrams/component.drawio)*

### 2.3 Module Structure

```
kiro-sdlc-agents/src/
  extension.ts                          ← Modified: register ChatPanelProvider
  langgraph/
    index.ts                            ← Public API exports
    state.ts                            ← PipelineState interface + Annotation
    graph-builder.ts                    ← buildPipelineGraph() factory
    langgraph-engine.ts                 ← LangGraphEngine class (singleton)
    nodes/
      base-node.ts                      ← Abstract base for all nodes
      sm-node.ts                        ← SM routing node
      ba-node.ts                        ← BA agent node
      sa-node.ts                        ← SA agent node
      qa-node.ts                        ← QA agent node
      dev-node.ts                       ← DEV agent node
      devops-node.ts                    ← DevOps agent node
      approval-node.ts                  ← HITL checkpoint node
    edges.ts                            ← Conditional routing functions
    checkpointer.ts                     ← WorkspaceCheckpointer (JSON file)
    stream-handler.ts                   ← StreamEvent → postMessage adapter
    mcp-bridge.ts                       ← Wraps McpServerManager for nodes
  chat-panel/
    chat-panel-provider.ts              ← WebviewViewProvider implementation
    message-handler.ts                  ← Incoming message dispatcher
    message-protocol.ts                 ← Chat-specific postMessage types

webview-assets/chat/
  index.html                            ← Chat Panel HTML shell
  chat.css                              ← Theme-aware styling
  chat.js                               ← Main chat logic (message rendering)
  graph-viz.js                          ← SVG graph visualization
  approval-ui.js                        ← Approval card component
  markdown-renderer.js                  ← Lightweight markdown → HTML
```

---

## 3. API Design

### 3.1 postMessage Protocol — Webview → Extension

These extend the existing `WebviewToExtMessage` union type in `types.ts`.

```typescript
// NEW: Chat Panel specific messages (added to WebviewToExtMessage union)
export type ChatWebviewToExtMessage =
  | { type: "chat:userMessage"; text: string }
  | { type: "chat:approvalAction"; decision: ApprovalDecision; feedback?: string }
  | { type: "chat:graphNodeClick"; nodeId: string }
  | { type: "chat:cancelStream"; streamId: string }
  | { type: "chat:clearHistory" }
  | { type: "chat:resumePipeline"; threadId: string }
  | { type: "chat:startFresh" }
  | { type: "ready" }
  | { type: "refresh" };
```

### 3.2 postMessage Protocol — Extension → Webview

```typescript
// NEW: Chat Panel specific messages (added to ExtToWebviewMessage union)
export type ChatExtToWebviewMessage =
  | { type: "chat:streamChunk"; streamId: string; nodeId: string; eventType: StreamEventType; content: string; timestamp: string; metadata?: Record<string, unknown> }
  | { type: "chat:streamComplete"; streamId: string; nodeId: string; finalContent: string; metadata?: Record<string, unknown> }
  | { type: "chat:graphUpdate"; nodes: PipelineGraphNode[] }
  | { type: "chat:approvalRequest"; checkpoint: QualityGateCheckpoint }
  | { type: "chat:chatHistory"; messages: ChatMessage[] }
  | { type: "chat:pipelineStatus"; status: PipelineStatus; phase: SDLCPhase; ticketKey: string }
  | { type: "chat:nodeDetails"; node: PipelineGraphNode; recentOutputs: AgentOutput[] }
  | { type: "chat:resumePrompt"; threadId: string; ticketKey: string; phase: SDLCPhase; pausedAt: string }
  | { type: "chat:error"; code: string; message: string; retryable: boolean }
  | { type: "serverStatus"; status: "connected" | "disconnected" | "failed" };

type StreamEventType = "token" | "status" | "progress" | "complete" | "error";
```

### 3.3 MCP Bridge — Node Tool Calls

Each LangGraph node calls MCP tools via the existing `McpServerManager.invokeTool()`:

| Node | MCP Tool | Arguments | Expected Response |
|------|----------|-----------|-------------------|
| SM | `mem_search` | `{ query: "{ticket} context" }` | Relevant KB entries |
| BA | `invoke_sub_agent` | `{ name: "ba-agent", prompt: "..." }` | BRD content |
| SA | `invoke_sub_agent` | `{ name: "sa-agent", prompt: "..." }` | TDD content |
| QA | `invoke_sub_agent` | `{ name: "qa-agent", prompt: "..." }` | STP/STC content |
| DEV | `invoke_sub_agent` | `{ name: "dev-agent", prompt: "..." }` | Code changes |
| DevOps | `invoke_sub_agent` | `{ name: "devops-agent", prompt: "..." }` | DPG content |

**Timeout**: 60s per tool call (BR-07). Total node timeout: 300s.

### 3.4 Chat Panel Commands

The Chat Panel accepts both ticket-based commands and direct commands:

| Input Pattern | Parsed Action | Graph Behavior |
|---------------|---------------|----------------|
| `KSA-210 tao BRD` | ticketKey=KSA-210, phase=requirements | SM → BA → QG-01 |
| `KSA-210 tao FSD` | ticketKey=KSA-210, phase=specification | SM → BA → QG-02 |
| `KSA-210 full` | ticketKey=KSA-210, phase=all | SM → BA → SA → ... |
| `status` | Direct command | Return pipelineStatus |
| `resume` | Resume last pipeline | Load checkpoint |
| `cancel` | Cancel active pipeline | Stop graph, persist |

---

## 4. Database / Storage Design

### 4.1 Pipeline State Persistence Schema

**Location**: `.vscode/kiro-pipeline-state/{threadId}.json`

```json
{
  "version": 1,
  "schemaVersion": "1.0.0",
  "state": {
    "ticketKey": "KSA-210",
    "threadId": "uuid-v4",
    "currentPhase": "specification",
    "pipelineStatus": "paused",
    "resumePoint": "ba",
    "documents": {
      "brd": { "status": "done", "version": 1, "path": "documents/KSA-210/BRD.md", "completedAt": "2025-01-27T10:00:00Z" },
      "fsd": { "status": "in_progress", "version": 0, "path": null, "completedAt": null }
    },
    "agentOutputs": [],
    "currentStreamId": null,
    "approvalRequired": false,
    "approvalDecision": null,
    "userFeedback": null,
    "pendingApprovals": [],
    "chatHistory": [],
    "errors": [],
    "retryCount": {},
    "createdAt": "2025-01-27T09:00:00Z",
    "lastUpdatedAt": "2025-01-27T10:05:00Z",
    "lastCheckpointAt": "2025-01-27T10:05:00Z"
  },
  "graphCheckpoint": {
    "configurable": { "thread_id": "uuid-v4" },
    "values": {},
    "next": ["ba"],
    "metadata": {}
  },
  "createdAt": "2025-01-27T09:00:00Z",
  "lastModified": "2025-01-27T10:05:00Z"
}
```

### 4.2 Storage Constraints

| Constraint | Value | Enforcement |
|-----------|-------|-------------|
| Max file size | 5MB | Trim agentOutputs to 50, chatHistory to 200 before write |
| Max pipelines | 10 per workspace | Archive oldest completed pipeline on overflow |
| Retention (completed) | 7 days | Background cleanup on extension activate |
| Atomic writes | .tmp → rename | Prevent corruption on crash |
| Schema versioning | `schemaVersion` field | Migration function on version mismatch |

### 4.3 Chat History Storage

Chat messages stored inline in pipeline state JSON. When history exceeds 200 messages:
1. Oldest 100 messages archived to `.vscode/kiro-pipeline-state/{threadId}-archive-{n}.json`
2. Active state retains latest 200

### 4.4 Security — No Secrets Rule (BR-10)

The checkpointer MUST strip sensitive fields before serialization:

```typescript
const SENSITIVE_PATTERNS = [/token/i, /key/i, /secret/i, /password/i, /credential/i];

function sanitizeForPersistence(state: PipelineState): PipelineState {
  // Deep-clone and strip any metadata fields matching sensitive patterns
  const sanitized = structuredClone(state);
  for (const output of sanitized.agentOutputs) {
    if (output.metadata) {
      for (const key of Object.keys(output.metadata)) {
        if (SENSITIVE_PATTERNS.some(p => p.test(key))) {
          delete output.metadata[key];
        }
      }
    }
  }
  return sanitized;
}
```

---

## 5. Class / Module Design

### 5.1 Class Diagram — LangGraph Module

![Class Diagram — LangGraph](diagrams/class-langgraph.png)
*[Edit in draw.io](diagrams/class-langgraph.drawio)*

### 5.2 Key Interfaces

```typescript
// === src/langgraph/state.ts ===

import { Annotation } from "@langchain/langgraph";

// LangGraph state annotation (typed channels)
export const PipelineAnnotation = Annotation.Root({
  ticketKey: Annotation<string>,
  threadId: Annotation<string>,
  currentPhase: Annotation<SDLCPhase>,
  pipelineStatus: Annotation<PipelineStatus>,
  resumePoint: Annotation<string | null>,
  documents: Annotation<Record<string, DocumentState>>,
  agentOutputs: Annotation<AgentOutput[]>({
    reducer: (existing, update) => [...existing, ...update].slice(-50),
  }),
  currentStreamId: Annotation<string | null>,
  approvalRequired: Annotation<boolean>,
  approvalDecision: Annotation<ApprovalDecision | null>,
  userFeedback: Annotation<string | null>,
  pendingApprovals: Annotation<QualityGateCheckpoint[]>,
  chatHistory: Annotation<ChatMessage[]>({
    reducer: (existing, update) => [...existing, ...update].slice(-200),
  }),
  errors: Annotation<PipelineError[]>,
  retryCount: Annotation<Record<string, number>>,
  createdAt: Annotation<string>,
  lastUpdatedAt: Annotation<string>,
  lastCheckpointAt: Annotation<string | null>,
});

export type PipelineState = typeof PipelineAnnotation.State;
```

### 5.3 LangGraphEngine Class

```typescript
// === src/langgraph/langgraph-engine.ts ===

export class LangGraphEngine {
  private graph: CompiledStateGraph | null = null;
  private checkpointer: WorkspaceCheckpointer;
  private streamHandler: StreamHandler;
  private mcpBridge: McpBridge;
  private activeThread: string | null = null;

  constructor(
    private mcpManager: McpServerManager,
    private workspaceRoot: string,
    private onEvent: (msg: ChatExtToWebviewMessage) => void
  ) {
    this.checkpointer = new WorkspaceCheckpointer(workspaceRoot);
    this.streamHandler = new StreamHandler(onEvent);
    this.mcpBridge = new McpBridge(mcpManager);
  }

  /** Lazy-init: build graph on first invocation */
  private async ensureGraph(): Promise<CompiledStateGraph> {
    if (!this.graph) {
      this.graph = await buildPipelineGraph(this.mcpBridge, this.streamHandler, this.checkpointer);
    }
    return this.graph;
  }

  /** Start a new pipeline execution */
  async invoke(ticketKey: string, phase: SDLCPhase, chatInput: string): Promise<void> { ... }

  /** Resume from persisted checkpoint */
  async resume(threadId: string): Promise<void> { ... }

  /** Handle human approval decision */
  async handleApproval(decision: ApprovalDecision, feedback?: string): Promise<void> { ... }

  /** Cancel active execution */
  cancel(): void { ... }

  /** List persisted pipelines for resume prompt */
  listPersistedPipelines(): PersistedPipelineInfo[] { ... }

  /** Get current graph state (for graph visualization) */
  getCurrentNodeStates(): PipelineGraphNode[] { ... }
}
```

### 5.4 Node Base Class

```typescript
// === src/langgraph/nodes/base-node.ts ===

export abstract class BaseNode {
  constructor(
    protected readonly nodeId: string,
    protected readonly mcpBridge: McpBridge,
    protected readonly streamHandler: StreamHandler
  ) {}

  /** Execute node logic — subclasses override */
  abstract execute(state: PipelineState): Promise<Partial<PipelineState>>;

  /** Wrap execution with timeout, error handling, streaming */
  async run(state: PipelineState): Promise<Partial<PipelineState>> {
    const startTime = Date.now();
    this.streamHandler.emitStatus(this.nodeId, "active", state.currentStreamId);

    try {
      const result = await this.withTimeout(
        this.execute(state),
        NODE_TIMEOUT_MS // 300s
      );
      const duration = Date.now() - startTime;
      this.streamHandler.emitComplete(this.nodeId, duration, state.currentStreamId);
      return {
        ...result,
        lastUpdatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleError(state, error as Error);
    }
  }

  protected async callMcp(toolName: string, args: Record<string, unknown>): Promise<string> {
    return this.mcpBridge.callTool(toolName, args, TOOL_CALL_TIMEOUT_MS); // 60s
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> { ... }
  private handleError(state: PipelineState, error: Error): Partial<PipelineState> { ... }
}
```

### 5.5 ChatPanelProvider

```typescript
// === src/chat-panel/chat-panel-provider.ts ===

export class ChatPanelProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private engine: LangGraphEngine | null = null;
  private messageBuffer: ChatExtToWebviewMessage[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly mcpManager: McpServerManager,
    private readonly workspaceRoot: string
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "webview-assets"),
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (msg: ChatWebviewToExtMessage) => this.handleMessage(msg)
    );

    webviewView.onDidDispose(() => { this.view = undefined; });
  }

  private sendToWebview(msg: ChatExtToWebviewMessage): void {
    if (this.view?.visible) {
      this.view.webview.postMessage(msg);
    } else {
      this.messageBuffer.push(msg);
      if (this.messageBuffer.length > 100) this.messageBuffer.shift();
    }
  }

  private getEngine(): LangGraphEngine {
    if (!this.engine) {
      this.engine = new LangGraphEngine(
        this.mcpManager,
        this.workspaceRoot,
        (msg) => this.sendToWebview(msg)
      );
    }
    return this.engine;
  }

  private async handleMessage(msg: ChatWebviewToExtMessage): Promise<void> { ... }
  private getHtml(webview: vscode.Webview): string { ... }
}
```

### 5.6 WorkspaceCheckpointer

```typescript
// === src/langgraph/checkpointer.ts ===

import { BaseCheckpointSaver, Checkpoint, CheckpointMetadata } from "@langchain/langgraph";

export class WorkspaceCheckpointer extends BaseCheckpointSaver {
  private stateDir: string;

  constructor(workspaceRoot: string) {
    super();
    this.stateDir = path.join(workspaceRoot, ".vscode", "kiro-pipeline-state");
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return undefined;
    const filePath = path.join(this.stateDir, `${threadId}.json`);
    if (!fs.existsSync(filePath)) return undefined;
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return { config, checkpoint: data.graphCheckpoint, metadata: {} };
  }

  async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) throw new Error("thread_id required");
    await this.ensureDir();
    const filePath = path.join(this.stateDir, `${threadId}.json`);
    const tmpPath = filePath + ".tmp";
    const data = { version: 1, schemaVersion: "1.0.0", graphCheckpoint: checkpoint, state: metadata, lastModified: new Date().toISOString() };
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, filePath);
    return config;
  }

  async list(config: RunnableConfig): Promise<CheckpointTuple[]> { ... }
  async delete(config: RunnableConfig): Promise<void> { ... }
  listPersistedPipelines(): PersistedPipelineInfo[] { ... }
  cleanup(maxAgeDays: number): void { ... }
  private ensureDir(): void { ... }
}
```

### 5.7 StreamHandler

```typescript
// === src/langgraph/stream-handler.ts ===

export class StreamHandler {
  private buffer: ChatExtToWebviewMessage[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 50; // BR-17

  constructor(private readonly emit: (msg: ChatExtToWebviewMessage) => void) {}

  /** Buffer token events, flush on debounce or complete */
  emitToken(nodeId: string, content: string, streamId: string | null): void {
    this.buffer.push({
      type: "chat:streamChunk",
      streamId: streamId ?? `stream-${nodeId}-${Date.now()}`,
      nodeId,
      eventType: "token",
      content,
      timestamp: new Date().toISOString(),
    });
    this.scheduleFlush();
  }

  /** Immediately flush on status/complete events */
  emitStatus(nodeId: string, status: string, streamId: string | null): void { ... }
  emitComplete(nodeId: string, duration: number, streamId: string | null): void { ... }
  emitError(nodeId: string, error: string, streamId: string | null): void { ... }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), this.DEBOUNCE_MS);
  }

  private flush(): void {
    this.flushTimer = null;
    for (const msg of this.buffer) { this.emit(msg); }
    this.buffer = [];
  }
}
```

### 5.8 McpBridge

```typescript
// === src/langgraph/mcp-bridge.ts ===

export class McpBridge {
  constructor(private readonly mcpManager: McpServerManager) {}

  async callTool(name: string, args: Record<string, unknown>, timeoutMs: number = 60000): Promise<string> {
    if (this.mcpManager.status !== "running") {
      throw new McpServerNotRunningError();
    }
    // Delegate to existing invokeTool with custom timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.mcpManager.invokeTool(name, args);
    } finally {
      clearTimeout(timer);
    }
  }

  isAvailable(): boolean {
    return this.mcpManager.status === "running";
  }
}
```

---

## 6. Integration Design

### 6.1 Extension Registration (extension.ts changes)

```typescript
// Add to activate():
import { ChatPanelProvider } from "./chat-panel/chat-panel-provider";

// In activate(), after mcpManager initialization:
const chatPanelProvider = new ChatPanelProvider(context.extensionUri, mcpManager, workspaceRoot);
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider("kiroChatPanel", chatPanelProvider, {
    webviewOptions: { retainContextWhenHidden: true }
  })
);
```

### 6.2 package.json Changes

```json
{
  "contributes": {
    "views": {
      "kiroSdlc": [
        { "id": "kiroSdlcTree", "name": "SDLC Agents" },
        { "id": "kiroChatPanel", "name": "Chat Panel", "type": "webview" }
      ]
    }
  },
  "dependencies": {
    "@langchain/langgraph": "^0.2.0",
    "@langchain/core": "^0.3.0"
  }
}
```

### 6.3 esbuild Configuration Changes

```javascript
// esbuild.js — add LangGraph to bundle
const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'], // LangGraph IS bundled (not external)
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !production,
  minify: production,
  treeShaking: true,
  // Analyze bundle size in production builds:
  metafile: production,
};
```

LangGraph.js and @langchain/core are bundled INTO the extension output via esbuild's tree-shaking. No need to mark them as external since they are pure JS without native addons.

### 6.4 MCP Server Communication Sequence

```
┌──────────┐      ┌────────────────┐      ┌───────────────┐      ┌───────────┐
│  BA Node │      │   McpBridge    │      │McpServerMgr   │      │ MCP Server│
└────┬─────┘      └───────┬────────┘      └───────┬───────┘      └─────┬─────┘
     │ callTool("invoke_  │                        │                     │
     │ sub_agent", {...})  │                        │                     │
     │────────────────────>│                        │                     │
     │                     │ invokeTool(name, args) │                     │
     │                     │───────────────────────>│                     │
     │                     │                        │ POST /mcp (JSON-RPC)│
     │                     │                        │────────────────────>│
     │                     │                        │                     │ Execute
     │                     │                        │                     │ sub-agent
     │                     │                        │   JSON-RPC response │
     │                     │                        │<────────────────────│
     │                     │      result (string)   │                     │
     │                     │<───────────────────────│                     │
     │   result (string)   │                        │                     │
     │<────────────────────│                        │                     │
```

---

## 7. Security Design

### 7.1 Content Security Policy (Webview)

Following the existing BasePanel pattern from `src/panels/base-panel.ts`:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'nonce-${nonce}';
  style-src ${webview.cspSource} 'unsafe-inline';
  img-src ${webview.cspSource} data:;
  font-src ${webview.cspSource};
  connect-src 'none';
">
```

Key enforcements:
- **No inline scripts**: All JS loaded via nonce-tagged `<script>` tags
- **No eval/Function**: CSP blocks dynamic code generation
- **No network**: `connect-src 'none'` prevents XSS exfiltration
- **Images**: Only from webview URI scheme or data: URIs (for graph SVG)

### 7.2 State Security (BR-10)

| Data | Rule | Implementation |
|------|------|----------------|
| API keys | Never in state | sanitizeForPersistence() strips matching fields |
| MCP auth tokens | Never in state | McpBridge handles auth in-memory only |
| User passwords | Never in state | Extension uses VS Code SecretStorage for credentials |
| Agent prompts | Allowed in state | Prompts are not secrets — needed for resume |
| File paths | Allowed in state | Relative paths only (workspace-portable) |
| Chat content | Allowed in state | User messages and agent responses are the feature |

### 7.3 Webview Sandbox

The Chat Panel webview runs in a restricted sandbox:
- **No Node.js access**: Cannot `require()` or access filesystem
- **No VS Code API**: Cannot call `vscode.*` directly (only via postMessage)
- **No network**: Cannot make fetch/XHR calls
- **Input sanitization**: All markdown rendered via safe HTML (no raw innerHTML of user content)

### 7.4 Markdown Rendering Security

The webview markdown renderer MUST:
1. Escape all HTML entities in code blocks
2. Sanitize link `href` attributes (only `http:`, `https:`, `vscode:` schemes)
3. Never render raw HTML from agent output
4. Use textContent for user messages (no markdown injection)

---

## 8. Performance & Scalability

### 8.1 Lazy Initialization (BR-11)

```typescript
// LangGraphEngine is NOT created at activation time
// It's created on first ChatPanelProvider message that requires it
private getEngine(): LangGraphEngine {
  if (!this.engine) {
    // This is the only time @langchain/langgraph is imported/initialized
    this.engine = new LangGraphEngine(this.mcpManager, this.workspaceRoot, ...);
  }
  return this.engine;
}
```

**Impact on activation time**: 0ms (graph module not loaded until first chat interaction).

### 8.2 Bundle Size Optimization

| Strategy | Expected Savings |
|----------|-----------------|
| esbuild tree-shaking | Eliminates unused LangGraph exports (~60% of package) |
| No LLM provider bundled | @langchain/core without OpenAI/Anthropic providers |
| Minimal LangGraph usage | Only StateGraph, Annotation, BaseCheckpointSaver imported |
| Production minification | Additional ~40% reduction |

**Target**: ≤500KB added to `out/extension.js` (measured via esbuild metafile).

### 8.3 Stream Batching (BR-17)

Token events batched with 50ms debounce window:
- Rapid LLM token emissions buffered and flushed as batch
- Status/complete/error events flush immediately (no debounce)
- Maximum buffer: 100 events (prevents memory issues)

### 8.4 Chat History Virtual Scrolling

For conversations >50 messages, the webview uses lazy rendering:
- Only visible messages + 10 above/below rendered in DOM
- Scroll events trigger render of new messages
- Old messages removed from DOM (not from memory)
- Prevents layout thrashing on long conversations

### 8.5 Checkpoint Write Performance

Target: ≤200ms for typical state (<1MB):
- Atomic write via .tmp file + rename (no partial writes on crash)
- JSON.stringify with no circular references (guaranteed by type system)
- Trim operations (agentOutputs cap, chatHistory cap) prevent unbounded growth

---

## 9. Monitoring & Observability

### 9.1 Logging

Using VS Code `OutputChannel` (existing pattern):

```typescript
const outputChannel = vscode.window.createOutputChannel("Kiro Chat Pipeline");
```

| Log Level | Events | Example |
|-----------|--------|---------|
| INFO | Pipeline start/stop, node transitions | `[Chat] Pipeline started: KSA-210 (thread: abc123)` |
| INFO | Checkpoint saved | `[Chat] Checkpoint saved: abc123.json (245KB)` |
| WARN | Timeouts, retries, MCP reconnection | `[Chat] BA node timeout (60s) — retrying` |
| ERROR | Node failures, state corruption | `[Chat] ERROR: State parse failed — resetting` |
| DEBUG | Stream events, postMessage traffic | `[Chat] Stream: 15 tokens flushed to webview` |

### 9.2 Metrics (Internal)

Tracked in-memory for status reporting:

| Metric | Type | Purpose |
|--------|------|---------|
| `pipeline.duration_ms` | Histogram | Total pipeline execution time |
| `node.duration_ms` | Histogram per node | Individual node performance |
| `stream.latency_ms` | Gauge | Time from emit to webview delivery |
| `checkpoint.write_ms` | Histogram | State persistence performance |
| `mcp.call_count` | Counter | MCP tool invocations |
| `mcp.error_count` | Counter | MCP failures |

### 9.3 Health Indicators

Reported in Chat Panel status header:

| Indicator | Green | Yellow | Red |
|-----------|-------|--------|-----|
| MCP Server | Running | Reconnecting | Unreachable |
| Pipeline | Running/Idle | Paused (waiting approval) | Failed |
| State | Saved | Saving... | Write failed |

---

## 10. Deployment

### 10.1 Extension Packaging

No changes to extension deployment — LangGraph is bundled:
1. `npm install` fetches @langchain/langgraph and @langchain/core
2. `npm run esbuild-production` tree-shakes and bundles into `out/extension.js`
3. `vsce package` produces .vsix with bundled code
4. Webview assets copied to `webview-assets/chat/` via `scripts/copy-resources.js`

### 10.2 Feature Flag

Optional: disable LangGraph features via configuration:

```json
{
  "kiroSdlc.enableChatPanel": {
    "type": "boolean",
    "default": true,
    "description": "Enable the Chat Panel sidebar with LangGraph pipeline orchestration."
  }
}
```

If disabled, `ChatPanelProvider.resolveWebviewView()` renders a disabled-state HTML.

### 10.3 Rollback Strategy

1. Extension version rollback: reinstall previous .vsix (all code bundled)
2. State files are forward-compatible: `schemaVersion` prevents loading newer state in older version
3. No database migrations needed (file-based state only)

---

## 11. Implementation Checklist

### Phase 1: Foundation (Must Have)

| # | Task | Files | Implements |
|---|------|-------|------------|
| 1 | Add @langchain/langgraph + @langchain/core to dependencies | `package.json` | Infrastructure |
| 2 | Verify esbuild bundles LangGraph correctly | `esbuild.js`, build test | Infrastructure |
| 3 | Create `src/langgraph/state.ts` — PipelineState + Annotation | New file | UC-01 |
| 4 | Create `src/langgraph/mcp-bridge.ts` — McpServerManager wrapper | New file | UC-01 |
| 5 | Create `src/langgraph/nodes/base-node.ts` — Abstract node | New file | UC-01 |
| 6 | Create `src/langgraph/nodes/sm-node.ts` — SM routing | New file | UC-01 |
| 7 | Create `src/langgraph/nodes/ba-node.ts` — BA agent | New file | UC-01 |
| 8 | Create `src/langgraph/nodes/sa-node.ts` — SA agent | New file | UC-01 |
| 9 | Create `src/langgraph/nodes/approval-node.ts` — HITL gate | New file | UC-05 |
| 10 | Create `src/langgraph/edges.ts` — Routing functions | New file | UC-01 |
| 11 | Create `src/langgraph/graph-builder.ts` — buildPipelineGraph() | New file | UC-01 |
| 12 | Create `src/langgraph/stream-handler.ts` — Event adapter | New file | UC-03 |
| 13 | Create `src/langgraph/checkpointer.ts` — WorkspaceCheckpointer | New file | UC-06 |
| 14 | Create `src/langgraph/langgraph-engine.ts` — Engine singleton | New file | UC-01 |
| 15 | Create `src/langgraph/index.ts` — Public exports | New file | UC-01 |

### Phase 2: Chat Panel UI (Must Have)

| # | Task | Files | Implements |
|---|------|-------|------------|
| 16 | Create `src/chat-panel/message-protocol.ts` — Type definitions | New file | UC-02 |
| 17 | Create `src/chat-panel/message-handler.ts` — Dispatcher | New file | UC-02 |
| 18 | Create `src/chat-panel/chat-panel-provider.ts` — WebviewViewProvider | New file | UC-02 |
| 19 | Create `webview-assets/chat/index.html` — Shell | New file | UC-02 |
| 20 | Create `webview-assets/chat/chat.css` — Theme-aware styles | New file | UC-02 |
| 21 | Create `webview-assets/chat/chat.js` — Main logic | New file | UC-02, UC-03 |
| 22 | Create `webview-assets/chat/markdown-renderer.js` — Safe MD→HTML | New file | UC-02 |
| 23 | Register ChatPanelProvider in extension.ts | Modified | UC-02 |
| 24 | Add "kiroChatPanel" view to package.json contributes | Modified | UC-02 |
| 25 | Update `scripts/copy-resources.js` for chat assets | Modified | Infrastructure |

### Phase 3: Graph Visualization (Should Have)

| # | Task | Files | Implements |
|---|------|-------|------------|
| 26 | Create `webview-assets/chat/graph-viz.js` — SVG rendering | New file | UC-04 |
| 27 | Add graph section to index.html | Modified | UC-04 |
| 28 | Wire graphUpdate messages to visualization | Modified chat.js | UC-04 |

### Phase 4: Quality Gates & Remaining Nodes (Must Have)

| # | Task | Files | Implements |
|---|------|-------|------------|
| 29 | Create `webview-assets/chat/approval-ui.js` — Approval cards | New file | UC-05 |
| 30 | Create `src/langgraph/nodes/qa-node.ts` | New file | UC-01 |
| 31 | Create `src/langgraph/nodes/dev-node.ts` | New file | UC-01 |
| 32 | Create `src/langgraph/nodes/devops-node.ts` | New file | UC-01 |
| 33 | Implement resume flow in ChatPanelProvider | Modified | UC-06 |
| 34 | Implement state cleanup/archival logic | Modified checkpointer.ts | UC-06 |

### Phase 5: Testing & Polish

| # | Task | Files | Implements |
|---|------|-------|------------|
| 35 | Unit tests: state serialization | New test file | TC-06, TC-12 |
| 36 | Unit tests: conditional routing | New test file | TC-01 |
| 37 | Unit tests: stream handler debounce | New test file | TC-03 |
| 38 | Integration test: full pipeline SM→BA→approval | New test file | TC-01, TC-04 |
| 39 | Bundle size verification (metafile analysis) | CI script | BR-11 |
| 40 | Activation time benchmark | Test script | TC-17 |

---

## 12. Error Handling Strategy

### 12.1 Error Hierarchy

```typescript
// Extension of existing error classes in types.ts

export class LangGraphError extends Error {
  constructor(message: string, public readonly code: string, public readonly recoverable: boolean) {
    super(message);
    this.name = "LangGraphError";
  }
}

export class NodeTimeoutError extends LangGraphError {
  constructor(nodeId: string, timeoutMs: number) {
    super(`Node '${nodeId}' timed out after ${timeoutMs}ms`, "NODE_TIMEOUT", true);
  }
}

export class NodeExecutionError extends LangGraphError {
  constructor(nodeId: string, cause: string) {
    super(`Node '${nodeId}' failed: ${cause}`, "NODE_FAILED", true);
  }
}

export class StateCorruptionError extends LangGraphError {
  constructor(threadId: string) {
    super(`State corrupted for thread '${threadId}'`, "STATE_CORRUPT", false);
  }
}

export class GraphBuildError extends LangGraphError {
  constructor(cause: string) {
    super(`Failed to build graph: ${cause}`, "GRAPH_ERROR", false);
  }
}
```

### 12.2 Error Recovery Matrix

| Error | Recovery Action | User Notification |
|-------|----------------|-------------------|
| MCP_UNREACHABLE | Pause graph, retry 3x with backoff (5s, 15s, 30s) | Chat error + retry button |
| MCP_TIMEOUT (60s) | Auto-retry once | "Retrying..." status |
| NODE_TIMEOUT (300s) | Pause, offer Retry/Skip | Chat error card |
| STATE_CORRUPT | Delete state, offer fresh start | "State corrupted — starting fresh" |
| GRAPH_ERROR | Log full trace, stop pipeline | VS Code error notification |
| WEBVIEW_DISPOSED | Buffer messages (max 100), continue pipeline | None (user action) |
| STREAM_STALL (30s) | Show "Still processing..." indicator | Inline status |

### 12.3 Retry Policy

```typescript
const RETRY_CONFIG = {
  mcp: { maxRetries: 3, backoffMs: [5000, 15000, 30000] },
  node: { maxRetries: 1, backoffMs: [1000] },
  checkpoint: { maxRetries: 2, backoffMs: [500, 1000] },
};
```

---

## 13. Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
| 3 | Class Diagram — LangGraph | [class-langgraph.png](diagrams/class-langgraph.png) | [class-langgraph.drawio](diagrams/class-langgraph.drawio) |

---
