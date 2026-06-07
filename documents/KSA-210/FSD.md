# Functional Specification Document (FSD)

## Kiro SDLC Agents - KSA-210: LangGraph.js Integration with Chat Panel

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-210 |
| Title | LangGraph.js Integration with Chat Panel |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-04 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-210.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-04 | BA Agent | Initiate document from BRD |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the LangGraph.js integration with the Chat Panel for the `kiro-sdlc-agents` VS Code extension (v1.15.0+). It defines use cases, data flows, API contracts, state management, and UI specifications that developers will implement to deliver a graph-based multi-agent orchestration experience within a sidebar chat interface.

### 1.2 Scope

- **LangGraph.js StateGraph**: Typed state graph orchestrating SDLC agents (SM, BA, SA, QA, DEV, DevOps) with conditional routing, checkpoints, and human-in-the-loop approval gates
- **Chat Panel (WebviewView)**: Sidebar panel providing chat interface, streaming responses, graph visualization, and approval UI
- **Extension-Webview Communication**: postMessage protocol between extension host and webview
- **Extension-MCP Communication**: LangGraph nodes wrapping MCP tool calls to existing server (port 9181)
- **State Persistence**: JSON serialization of graph state to VS Code workspace storage for crash recovery and resume

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| StateGraph | LangGraph.js primary abstraction - directed graph where nodes are functions and edges define control flow |
| WebviewView | VS Code API for rendering custom HTML UI in sidebar/panel areas |
| MCP | Model Context Protocol - communication between AI tools and host applications |
| HITL | Human-in-the-Loop - pattern where automated workflow pauses for human decision |
| Checkpoint | Persist point in graph execution allowing resume after interrupt |
| postMessage | VS Code API for bi-directional communication between extension host and webview |
| Quality Gate | Defined checkpoint in SDLC pipeline requiring approval before proceeding |
| CSP | Content Security Policy - browser security mechanism preventing XSS |
| Node | A function in the StateGraph representing one SDLC agent phase |
| Edge | A connection between nodes defining control flow (conditional or unconditional) |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-210/BRD.md |
| Extension Source | kiro-sdlc-agents/src/ |
| MCP Server Engine | mcp-code-intelligence-nodejs/src/orchestration/engine.ts |
| LangGraph.js Docs | https://langchain-ai.github.io/langgraphjs/ |
| VS Code WebviewView API | https://code.visualstudio.com/api/references/vscode-api#WebviewView |
| BasePanel Pattern | kiro-sdlc-agents/src/panels/base-panel.ts |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)
*[Edit in draw.io](diagrams/system-context.drawio)*

The system introduces two new components within the existing `kiro-sdlc-agents` extension:

**Actors:**
- **Developer**: Interacts via Chat Panel sidebar, sends commands, approves/rejects at quality gates
- **VS Code Host**: Provides extension API, workspace storage, webview infrastructure

**Systems:**
- **LangGraph StateGraph Engine**: Orchestrates pipeline nodes with typed state and conditional routing
- **Chat Panel (WebviewView)**: HTML/CSS/JS sidebar UI for chat, streaming, graph visualization
- **MCP Server (port 9181)**: Existing orchestration engine providing tool execution, memory, KB
- **VS Code Workspace Storage**: Persistence layer for graph state (JSON files)

**Data Flows:**
- Developer -> Chat Panel: text commands, approval actions
- Chat Panel -> Extension Host: postMessage (WebviewToExtMessage)
- Extension Host -> LangGraph: invoke graph with user input
- LangGraph Node -> MCP Server: tool calls (HTTP/stdio)
- MCP Server -> LangGraph Node: tool results
- LangGraph -> Extension Host: streaming events, state updates
- Extension Host -> Chat Panel: postMessage (ExtToWebviewMessage)
- Extension Host -> Workspace Storage: state persistence (JSON)

### 2.2 System Architecture

The feature integrates into the existing extension architecture:

```
kiro-sdlc-agents/src/
  extension.ts              (activate: register ChatPanelProvider)
  langgraph/
    state.ts                (PipelineState interface + annotations)
    graph-builder.ts        (buildPipelineGraph() - creates StateGraph)
    nodes/
      sm-node.ts            (SM agent node)
      ba-node.ts            (BA agent node)
      sa-node.ts            (SA agent node)
      qa-node.ts            (QA agent node)
      dev-node.ts           (DEV agent node)
      devops-node.ts        (DevOps agent node)
      approval-node.ts      (HITL checkpoint node)
    edges.ts                (conditional routing functions)
    checkpointer.ts         (workspace storage checkpoint saver)
    stream-handler.ts       (event stream to postMessage adapter)
  chat-panel/
    chat-panel-provider.ts  (WebviewViewProvider implementation)
    message-protocol.ts     (type definitions for postMessage)
  webview/
    chat/
      index.html            (Chat Panel HTML)
      chat.css              (styling - theme-aware)
      chat.js               (message rendering, streaming, graph viz)
```

---

## 3. Functional Requirements

### 3.1 Feature: LangGraph StateGraph Orchestration

**Source:** BRD Story 1

#### 3.1.1 Description

Implement a LangGraph.js StateGraph that orchestrates the multi-agent SDLC pipeline. Each node wraps MCP tool calls to the existing server. The graph supports conditional routing based on pipeline phase, checkpoint persistence for resume, and human-in-the-loop gates.

#### 3.1.2 Use Case: UC-01 - Execute SDLC Pipeline via StateGraph

**Use Case ID:** UC-01
**Actor:** Developer
**Preconditions:** Extension activated, MCP server running (port 9181), Chat Panel open
**Postconditions:** Pipeline executes through requested phases, documents created, state persisted

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Types command in Chat Panel | | Developer submits pipeline request (e.g., "KSA-210 tao BRD") |
| 2 | | Parse input | Extract ticket key, action, optional parameters |
| 3 | | Initialize StateGraph | Create graph instance with initial PipelineState |
| 4 | | Route to SM node | SM node determines current phase from input |
| 5 | | SM node calls MCP | Fetch ticket info via MCP tools |
| 6 | | Route to target node | Conditional edge routes to BA/SA/QA/DEV based on phase |
| 7 | | Target node executes | Node wraps MCP tool calls for agent logic |
| 8 | | Emit streaming events | Node sends progress/content events during execution |
| 9 | | Checkpoint state | Persist state after node completion |
| 10 | | Check quality gate | Evaluate if approval required before next node |
| 11 | | Route to next node or pause | Continue pipeline or wait for HITL |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Pipeline already in progress (resumed) | Skip Steps 2-3, load persisted state, resume from checkpoint |
| AF-02 | Parallel nodes available | Execute independent nodes concurrently (e.g., QA + DevOps) |
| AF-03 | User provides additional context mid-pipeline | Inject into state.userFeedback, node reads on next invocation |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | MCP server unreachable | Node catches connection error, updates state.errors, emits error event, graph pauses |
| EF-02 | Node execution timeout (>60s per tool call) | Abort node, record timeout error, route to error handling |
| EF-03 | Invalid ticket key | SM node validates, returns error message, graph terminates cleanly |
| EF-04 | State deserialization failure | Reset corrupted state, notify user, offer fresh start |

---

### 3.2 Feature: Chat Panel WebviewView

**Source:** BRD Story 2

#### 3.2.1 Description

A sidebar Chat Panel implemented as VS Code WebviewViewProvider. Provides a familiar chat interface for interacting with the LangGraph pipeline, viewing streaming responses, and managing quality gate approvals.

#### 3.2.2 Use Case: UC-02 - Chat Interaction with Agent Pipeline

**Use Case ID:** UC-02
**Actor:** Developer
**Preconditions:** Extension activated, Chat Panel visible in sidebar
**Postconditions:** Message sent, pipeline invoked or command executed, response displayed

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Types message in input box | | Developer enters command or question |
| 2 | Presses Enter or clicks Send | | Submit message |
| 3 | | Display user message bubble | Render in chat list (right-aligned, themed background) |
| 4 | | Send postMessage to extension | WebviewToExtMessage type="userMessage" |
| 5 | | Extension receives message | Parse command, invoke LangGraph |
| 6 | | Extension streams response | Multiple postMessage events (type="streamChunk") |
| 7 | | Render streaming response | Typewriter effect in agent message bubble |
| 8 | | Stream complete | Final message render with full markdown |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Simple command (e.g., "status") | Extension handles directly without LangGraph, returns status JSON |
| AF-02 | Panel collapsed during streaming | Messages buffered in extension, rendered when panel re-expands |
| AF-03 | User sends new message while streaming | Queue message, process after current stream completes |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Webview disposed during operation | Extension detects disposal, cancels stream, preserves state |
| EF-02 | postMessage fails (webview not ready) | Retry once after 100ms, then log error and buffer |

---

### 3.3 Feature: Real-time Streaming Responses

**Source:** BRD Story 3

#### 3.3.1 Description

LangGraph nodes emit streaming events during execution. The extension forwards these as postMessage events to the Chat Panel, which renders them progressively with a typewriter effect.

#### 3.3.2 Use Case: UC-03 - Stream Agent Response to Chat Panel

**Use Case ID:** UC-03
**Actor:** Developer (passive - observing)
**Preconditions:** Pipeline executing, Chat Panel open
**Postconditions:** Real-time response visible, final message complete with markdown

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | LangGraph node starts processing | Node begins MCP tool call |
| 2 | | Node emits stream event | StreamEvent: type="token", content="Analyzing..." |
| 3 | | StreamHandler transforms event | Map to ExtToWebviewMessage format with streamId |
| 4 | | Extension sends postMessage | Forward to webview via panel.webview.postMessage() |
| 5 | | Chat Panel appends content | Typewriter render into active agent bubble |
| 6 | | Repeat steps 2-5 | Until node completes |
| 7 | | Node emits "complete" event | Final content + metadata (duration, phase) |
| 8 | | Chat Panel finalizes message | Full markdown render, remove streaming indicator |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Status update (not content) | Render as status badge update in header, not chat bubble |
| AF-02 | Progress event with percentage | Update progress bar indicator in active bubble |
| AF-03 | Multiple nodes streaming concurrently | Each stream renders in separate bubble, ordered by start time |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Stream stall (no event for 30s) | Show "Still processing..." indicator, keep connection open |
| EF-02 | Extension host crash during stream | On recovery, load last checkpoint, show incomplete message with "[interrupted]" |

![Sequence - Chat Flow](diagrams/sequence-chat-flow.png)
*[Edit in draw.io](diagrams/sequence-chat-flow.drawio)*

---

### 3.4 Feature: Graph Visualization

**Source:** BRD Story 4

#### 3.4.1 Description

A mini graph visualization in the Chat Panel showing pipeline nodes and their states. Updates in real-time as the graph executes. Renders as SVG in a collapsible section above the chat messages.

#### 3.4.2 Use Case: UC-04 - View Pipeline Graph State

**Use Case ID:** UC-04
**Actor:** Developer
**Preconditions:** Pipeline initialized (at least one graph invocation)
**Postconditions:** Graph visualization reflects current pipeline state accurately

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Graph state changes | Node transitions (pending -> active -> done) |
| 2 | | Extension emits graphUpdate | postMessage type="graphUpdate" with all node states |
| 3 | | Chat Panel renders graph | SVG nodes with color-coded states and edge arrows |
| 4 | Clicks on a node | | Developer wants node details |
| 5 | | Send graphNodeClick message | postMessage type="graphNodeClick" with nodeId |
| 6 | | Extension responds with details | postMessage type="nodeDetails" with outputs, duration |
| 7 | | Show node detail popover | Tooltip/card with last output, timing, status |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Panel width < 350px | Switch to vertical compact layout (nodes stacked vertically) |
| AF-02 | Graph section collapsed by user | Buffer graphUpdate events, apply all on expand |
| AF-03 | No pipeline started yet | Show empty state: "Start a pipeline to see the graph" |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Graph data inconsistent with actual state | Re-fetch full state from extension, force re-render |
| EF-02 | SVG rendering fails | Fall back to text-based node list |

---

### 3.5 Feature: Human-in-the-Loop Quality Gates

**Source:** BRD Story 5

#### 3.5.1 Description

At defined quality gate checkpoints, the StateGraph pauses execution and the Chat Panel displays approval UI. The developer reviews the checkpoint summary and chooses to approve, reject with feedback, or provide additional context.

#### 3.5.2 Use Case: UC-05 - Approve/Reject at Quality Gate

**Use Case ID:** UC-05
**Actor:** Developer
**Preconditions:** Graph reached a quality gate checkpoint, approval UI visible in Chat Panel
**Postconditions:** Graph resumes (approved), loops back (rejected), or waits (no action)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Graph reaches quality gate | Node complete, state.approvalRequired = true |
| 2 | | Emit approvalRequest event | Include summary of completed work + artifacts list |
| 3 | | Chat Panel shows approval card | Context summary + [Approve] [Reject] [Feedback] buttons |
| 4 | Clicks [Approve] | | Developer approves checkpoint |
| 5 | | Send approvalAction postMessage | type="approvalAction", decision="approved" |
| 6 | | Extension updates graph state | state.approvalDecision = "approved", approvalRequired = false |
| 7 | | Resume graph execution | Conditional edge routes to next node |
| 8 | | Update graph visualization | Approval checkpoint node = done (green) |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Developer clicks [Reject] | Show feedback textarea; user types reason; state.approvalDecision="rejected", state.userFeedback=text; graph routes BACK to previous node |
| AF-02 | Developer clicks [Feedback] | Show textarea for additional context without rejecting; inject into state, node re-processes |
| AF-03 | No action taken (indefinite pause) | Graph stays paused, state persisted, reminder after 24h |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | VS Code restart while waiting | State persisted with approvalRequired=true; on resume, show approval UI again |
| EF-02 | Multiple gates pending (should not happen) | Queue in pendingApprovals array, show one at a time FIFO |

**Quality Gate Checkpoints:**

| Gate ID | After Node | Summary Shown | Available Actions |
|---------|-----------|---------------|-------------------|
| QG-01 | BA (BRD complete) | BRD summary, user stories count, diagrams | Approve / Reject / Edit |
| QG-02 | SA (FSD complete) | FSD summary, use cases, API contracts | Approve / Reject / Edit |
| QG-03 | SA (TDD complete) | TDD summary, architecture decisions | Approve / Reject / Edit |
| QG-04 | DEV (Code complete) | Files changed, test results summary | Approve / Reject / Rerun |
| QG-05 | QA (Tests complete) | Test pass/fail summary, coverage | Approve / Reject / Rerun |

---

### 3.6 Feature: Persistent State and Resume

**Source:** BRD Story 6

#### 3.6.1 Description

The LangGraph state is serialized to JSON and stored in VS Code workspace storage. On extension activation, persisted state is detected and the user is offered to resume the pipeline from the last checkpoint.

#### 3.6.2 Use Case: UC-06 - Resume Pipeline After Restart

**Use Case ID:** UC-06
**Actor:** Developer
**Preconditions:** Previous pipeline state exists in workspace storage, extension activating
**Postconditions:** Pipeline resumes from last checkpoint, chat history restored, graph viz accurate

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension activates | VS Code starts or window reloads |
| 2 | | Check workspace storage | Look for .vscode/kiro-pipeline-state/*.json |
| 3 | | State file found | Deserialize JSON, validate schema integrity |
| 4 | | Chat Panel shows resume banner | "Pipeline KSA-210 paused at BA node. [Resume] [Start Fresh]" |
| 5 | Clicks [Resume] | | Developer chooses to continue |
| 6 | | Restore graph state | Rebuild StateGraph with checkpointer, load state |
| 7 | | Restore chat history | Send chatHistory postMessage with stored messages |
| 8 | | Restore graph visualization | Send graphUpdate with persisted node states |
| 9 | | Resume execution | Continue from persisted resumePoint node |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Developer clicks [Start Fresh] | Delete persisted state file, clear chat, begin new pipeline |
| AF-02 | Files on disk changed (conflict) | Show warning: "BRD.md modified externally since last run. Resume anyway?" |
| AF-03 | Multiple pipelines persisted | Show list: "[KSA-210 - paused at BA] [KSA-211 - paused at QA]", user picks |
| AF-04 | Pipeline was completed (status=completed) | No resume prompt; archive state after 7 days |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | JSON parse error (corrupted state) | Delete file, log error, notify: "State corrupted. Starting fresh." |
| EF-02 | MCP server not available on resume | Show error, offer retry; state remains persisted for later |
| EF-03 | State schema version mismatch (after extension update) | Attempt migration; if fail, offer fresh start |

---

### 3.7 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | StateGraph must be typed with PipelineState interface (TypeScript strict mode) | BRD Story 1 |
| BR-02 | Each node must complete all MCP tool calls before emitting "complete" event | BRD Story 1 |
| BR-03 | State must be JSON-serializable: no functions, circular refs, Date objects (use ISO strings) | BRD Story 6 |
| BR-04 | Quality gates mandatory after: BA node, SA node (FSD), SA node (TDD), DEV node, QA node | BRD Story 5 |
| BR-05 | Streaming latency from node emit to Chat Panel render <= 200ms | BRD NFR |
| BR-06 | Chat history maximum: 200 messages; older messages archived to separate file | BRD NFR |
| BR-07 | Node timeout: 60s per MCP tool call, 300s total per node execution | BRD Story 1 |
| BR-08 | State persistence on every checkpoint: after node complete + after approval action | BRD Story 6 |
| BR-09 | Webview CSP: nonce-based scripts, no external connections, no inline eval | BRD NFR |
| BR-10 | No secrets (API keys, tokens, credentials) stored in persisted state JSON | BRD NFR |
| BR-11 | Extension activation time increase from LangGraph <= 500ms (use lazy initialization) | BRD NFR |
| BR-12 | Chat Panel must be fully functional at minimum panel width of 250px | BRD Story 2 |
| BR-13 | Rejected node receives full rejection feedback text in state.userFeedback field | BRD Story 5 |
| BR-14 | Completed pipelines auto-archive (move to .archive/) after 7 days | BRD Story 6 |
| BR-15 | Graph visualization colors: pending=#808080, active=#4A90D9, done=#4CAF50, error=#F44336, paused=#FFC107 | BRD Story 4 |
| BR-16 | Approval cards show max 500 chars of summary; "Show more" link for full content | BRD Story 5 |
| BR-17 | Stream events batched with max 50ms debounce for rapid token emissions | BRD Story 3 |
| BR-18 | Graph node click popover shows: last output (truncated 200 chars), duration, status | BRD Story 4 |

![State - Pipeline Phases](diagrams/state-pipeline.png)
*[Edit in draw.io](diagrams/state-pipeline.drawio)*

---

## 4. Data Model

### 4.1 State Schema (PipelineState)

This is the core typed state interface used by LangGraph StateGraph. All fields must be JSON-serializable.

```typescript
interface PipelineState {
  // Identity
  ticketKey: string;                              // e.g., "KSA-210"
  threadId: string;                               // UUID - unique pipeline execution ID

  // Pipeline Control
  currentPhase: SDLCPhase;                        // Current pipeline phase
  pipelineStatus: PipelineStatus;                 // Overall pipeline status
  resumePoint: string | null;                     // Node ID to resume from after restart

  // Documents
  documents: Record<string, DocumentState>;       // Keyed by doc type: brd, fsd, tdd, stp, stc

  // Agent Communication
  agentOutputs: AgentOutput[];                    // Chronological agent responses (max 50 kept)
  currentStreamId: string | null;                 // Active stream identifier

  // Human-in-the-Loop
  approvalRequired: boolean;                      // Whether waiting for human decision
  approvalDecision: ApprovalDecision | null;      // Current decision
  userFeedback: string | null;                    // Free-text feedback on rejection
  pendingApprovals: QualityGateCheckpoint[];      // FIFO queue of pending gates

  // Chat
  chatHistory: ChatMessage[];                     // Conversation history (max 200)

  // Error Handling
  errors: PipelineError[];                        // Accumulated errors
  retryCount: Record<string, number>;             // Per-node retry counters (max 3)

  // Metadata
  createdAt: string;                              // ISO8601 creation timestamp
  lastUpdatedAt: string;                          // ISO8601 last state mutation
  lastCheckpointAt: string | null;                // ISO8601 last persist time
}
```

### 4.2 Supporting Types

```typescript
type SDLCPhase =
  | "requirements"
  | "specification"
  | "design"
  | "test_planning"
  | "implementation"
  | "testing"
  | "deployment";

type PipelineStatus = "idle" | "running" | "paused" | "completed" | "failed";

type ApprovalDecision = "approved" | "rejected" | "feedback";

interface DocumentState {
  status: "not_started" | "in_progress" | "done" | "needs_revision";
  version: number;
  path: string | null;             // Relative: "documents/KSA-210/BRD.md"
  completedAt: string | null;      // ISO8601
}

interface AgentOutput {
  id: string;                      // UUID
  nodeId: string;                  // Which graph node produced this
  type: "token" | "status" | "complete" | "error";
  content: string;
  timestamp: string;               // ISO8601
  metadata?: Record<string, unknown>;
}

interface ChatMessage {
  id: string;                      // UUID
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;               // ISO8601
  agentName?: string;              // e.g., "BA Agent", "SM Agent"
  streamId?: string;               // Links to streaming session
  isComplete: boolean;             // false during streaming
}

interface PipelineError {
  id: string;                      // UUID
  nodeId: string;
  code: string;                    // e.g., "MCP_TIMEOUT", "PARSE_ERROR"
  message: string;
  timestamp: string;               // ISO8601
  recoverable: boolean;
}

interface QualityGateCheckpoint {
  id: string;                      // UUID
  afterNode: string;               // Node that just completed
  summary: string;                 // Human-readable (max 500 chars)
  artifacts: string[];             // File paths created/modified
  createdAt: string;               // ISO8601
}

interface GraphNodeState {
  nodeId: string;                  // e.g., "sm", "ba", "sa"
  label: string;                   // Display name: "BA Agent"
  status: "pending" | "active" | "done" | "error" | "paused";
  startedAt?: string;
  completedAt?: string;
  duration?: number;               // milliseconds
  lastOutput?: string;             // Truncated (200 chars max)
}
```

### 4.3 Entity Relationships

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| PipelineState | DocumentState | 1:N (max 7) | One pipeline tracks BRD, FSD, TDD, STP, STC, UG, DPG |
| PipelineState | AgentOutput | 1:N (max 50) | Pipeline accumulates outputs (trimmed for persistence) |
| PipelineState | ChatMessage | 1:N (max 200) | Pipeline owns conversation history |
| PipelineState | PipelineError | 1:N | Pipeline accumulates errors |
| PipelineState | QualityGateCheckpoint | 1:N (max 5) | Pending approval queue |
| QualityGateCheckpoint | string[] (artifacts) | 1:N | Gate references file paths it produced |

### 4.4 Storage Schema

**File:** `.vscode/kiro-pipeline-state/{threadId}.json`

```json
{
  "version": 1,
  "state": { "...PipelineState fields..." },
  "graphCheckpoint": { "...LangGraph internal checkpoint..." },
  "createdAt": "2026-06-04T10:00:00Z",
  "lastModified": "2026-06-04T12:30:00Z"
}
```

Maximum file size: 5MB. If exceeded, trim agentOutputs to last 50 entries and chatHistory to last 200 messages.

---

## 5. Integration Specifications

### 5.1 Extension <-> Webview (postMessage Protocol)

| Attribute | Value |
|-----------|-------|
| Purpose | Bi-directional communication between extension host and Chat Panel |
| Direction | Bidirectional |
| Data Format | JSON (TypeScript typed) |
| Frequency | Real-time: per user action + per stream event (can be 100+/sec during streaming) |
| Latency Target | <= 50ms per message delivery |

#### 5.1.1 Webview -> Extension Messages

| Message Type | Payload Fields | Trigger |
|--------------|----------------|---------|
| userMessage | `{ text: string }` | User sends chat message |
| approvalAction | `{ decision: ApprovalDecision, feedback?: string }` | Approval button click |
| graphNodeClick | `{ nodeId: string }` | Click on graph visualization node |
| ready | `{}` | Webview DOM loaded |
| refresh | `{}` | User requests data refresh |
| cancelStream | `{ streamId: string }` | User cancels active stream |
| clearHistory | `{}` | User clears conversation |
| resumePipeline | `{ threadId: string }` | User clicks Resume |
| startFresh | `{}` | User clicks Start Fresh |

#### 5.1.2 Extension -> Webview Messages

| Message Type | Payload Fields | Trigger |
|--------------|----------------|---------|
| streamChunk | `{ streamId, nodeId, type, content, timestamp }` | Node emits event |
| streamComplete | `{ streamId, nodeId, finalContent, metadata }` | Node finishes |
| graphUpdate | `{ nodes: GraphNodeState[] }` | Any node state change |
| approvalRequest | `{ checkpoint: QualityGateCheckpoint }` | Quality gate reached |
| chatHistory | `{ messages: ChatMessage[] }` | Initial load or resume |
| pipelineStatus | `{ status: PipelineStatus, phase: SDLCPhase, ticketKey: string }` | Pipeline state change |
| error | `{ code: string, message: string, retryable: boolean }` | Error occurred |
| serverStatus | `{ status: "connected" | "disconnected" | "failed" }` | MCP server health |
| nodeDetails | `{ node: GraphNodeState, recentOutputs: AgentOutput[] }` | Response to graphNodeClick |
| resumePrompt | `{ threadId, ticketKey, phase, pausedAt: string }` | Persisted state found |

### 5.2 Extension <-> MCP Server

| Attribute | Value |
|-----------|-------|
| Purpose | LangGraph nodes invoke MCP tools for SDLC agent execution |
| Direction | Outbound (Extension -> MCP, responses back) |
| Protocol | MCP over stdio (bundled server managed by McpServerManager) |
| Data Format | JSON-RPC 2.0 |
| Frequency | 1-N tool calls per node execution |
| Timeout | 60s per tool call (configurable) |

#### 5.2.1 MCP Tool Calls per Node

| Node | Tools Called | Purpose |
|------|-------------|---------|
| SM | `find_tools`, `mem_search`, `jira_get_issue` | Discover tools, fetch context, get ticket |
| BA | `invoke_sub_agent` (ba-agent), `mem_ingest_file` | Execute BA logic, store docs in KB |
| SA | `invoke_sub_agent` (sa-agent), `mem_search` | Execute SA logic with KB context |
| QA | `invoke_sub_agent` (qa-agent) | Execute QA for test planning/execution |
| DEV | `invoke_sub_agent` (dev-agent) | Execute DEV for implementation |
| DevOps | `invoke_sub_agent` (devops-agent) | Execute DevOps for deployment |
| Approval | (none - waits for human input) | Pauses graph, no MCP calls |

#### 5.2.2 Node Function Signature

```typescript
// Each node follows this pattern
async function baNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const mcpResult = await mcpClient.callTool("invoke_sub_agent", {
    name: "ba-agent",
    prompt: `Tao BRD cho ${state.ticketKey}`,
    contextFiles: [{ path: ".kiro/steering/drawio.md" }]
  });

  const output: AgentOutput = {
    id: generateId(),
    nodeId: "ba",
    type: "complete",
    content: extractText(mcpResult),
    timestamp: new Date().toISOString()
  };

  return {
    agentOutputs: [...state.agentOutputs, output],
    documents: {
      ...state.documents,
      brd: { status: "done", version: 1, path: `documents/${state.ticketKey}/BRD.md`, completedAt: output.timestamp }
    },
    currentPhase: "specification",
    approvalRequired: true  // Trigger quality gate
  };
}
```

### 5.3 VS Code Workspace Storage

| Attribute | Value |
|-----------|-------|
| Purpose | Persist pipeline state for crash recovery and resume |
| Direction | Read/Write from extension host |
| Location | `.vscode/kiro-pipeline-state/{threadId}.json` |
| Frequency | On every checkpoint event |
| Max Size | 5MB per pipeline state file |
| Retention | 7 days after pipeline completion, then auto-delete |

---

## 6. Processing Logic

### 6.1 Graph Construction (buildPipelineGraph)

**Trigger:** First pipeline invocation in session
**Input:** Node function definitions, conditional edge logic
**Output:** Compiled LangGraph StateGraph ready for invocation

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Import StateGraph from @langchain/langgraph | Fail activation if package missing |
| 2 | Define state annotation with PipelineState channels | TypeScript compile-time check |
| 3 | Add nodes: sm, ba, sa, qa, dev, devops, approval | Validate each is async function |
| 4 | Add entry point: __start__ -> sm | Required by LangGraph |
| 5 | Add conditional edges from SM (route by currentPhase) | Default fallback to error state |
| 6 | Add conditional edges after each agent node (check approvalRequired) | True -> approval, False -> next node |
| 7 | Add conditional edge from approval node (check approvalDecision) | approved -> next, rejected -> previous |
| 8 | Set __end__ condition (pipelineStatus === "completed") | Pipeline terminates cleanly |
| 9 | Compile graph with WorkspaceCheckpointer | Validate no unreachable nodes |

### 6.2 Conditional Routing Logic

```typescript
function routeFromSm(state: PipelineState): string {
  switch (state.currentPhase) {
    case "requirements": return "ba";
    case "specification": return "ba";  // BA creates FSD draft
    case "design": return "sa";
    case "test_planning": return "qa";
    case "implementation": return "dev";
    case "testing": return "qa";
    case "deployment": return "devops";
    default: return "__end__";
  }
}

function routeAfterNode(state: PipelineState): string {
  if (state.approvalRequired) return "approval";
  if (state.pipelineStatus === "completed") return "__end__";
  return "sm";  // Route back to SM for next phase determination
}

function routeAfterApproval(state: PipelineState): string {
  if (state.approvalDecision === "approved") return "sm";
  if (state.approvalDecision === "rejected") return state.resumePoint || "sm";
  return "approval";  // Stay in approval if no decision yet
}
```

### 6.3 State Persistence (WorkspaceCheckpointer)

**Trigger:** After each node completion, after each approval action
**Input:** Current PipelineState + LangGraph internal checkpoint data
**Output:** JSON file at .vscode/kiro-pipeline-state/{threadId}.json

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Serialize PipelineState to JSON | Strip undefined fields, convert Dates to ISO strings |
| 2 | Validate JSON size < 5MB | If exceeded: trim agentOutputs to last 50, archive old chatHistory |
| 3 | Write atomically (write to .tmp, then rename) | Retry once on EBUSY/EPERM, then log warning |
| 4 | Update state.lastCheckpointAt | In-memory only (persisted on next checkpoint) |
| 5 | Schedule archive cleanup (completed pipelines > 7 days) | Best-effort, non-blocking, run every 24h |

### 6.4 Stream Event Processing

**Trigger:** LangGraph node emits event during async iteration
**Input:** Raw LangGraph StreamEvent
**Output:** ExtToWebviewMessage sent to Chat Panel

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Receive event from graph.stream() async iterator | Handle StopAsyncIteration for completion |
| 2 | Map to ExtToWebviewMessage format (streamChunk or streamComplete) | Unknown event types -> log and skip |
| 3 | Add to debounce buffer (50ms window for rapid tokens) | Flush on complete/error events immediately |
| 4 | On buffer flush: send postMessage to webview | If webview disposed: buffer in memory (max 100 events) |
| 5 | Append event to state.agentOutputs | Async append, non-blocking |
| 6 | On streamComplete: trigger checkpoint | Persistence step |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Screens/Features |
|------|-------------|-------------------|
| Developer (local user) | Full access | Chat Panel, approval actions, state management, pipeline control |
| Extension Host process | MCP tool invocation, file I/O | Calls to localhost MCP server, workspace storage |
| Webview (sandboxed) | postMessage only | Cannot access filesystem, network, Node.js APIs, or VS Code API directly |

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Pipeline state JSON | Internal | Must NOT contain API keys, tokens, or credentials (BR-10) |
| Chat history | Internal | Stored locally in workspace only, never transmitted externally |
| MCP tool results | Internal | May contain code/document content - local only |
| Webview rendered content | Sandboxed | CSP enforced - no external scripts or network connections |

### 7.3 Content Security Policy (Webview)

The Chat Panel webview MUST enforce strict CSP (following existing BasePanel pattern):

```
default-src 'none';
script-src 'nonce-{dynamic-nonce}';
style-src ${webview.cspSource} 'unsafe-inline';
img-src ${webview.cspSource} data:;
font-src ${webview.cspSource};
connect-src 'none';
```

Key restrictions:
- No inline scripts (all JS via nonce-tagged script tags)
- No external network connections from webview
- Images only from webview URI scheme or data: URIs
- No eval() or Function() constructors

### 7.4 Audit Trail

| Event | Logged Fields | Destination | Retention |
|-------|--------------|-------------|-----------|
| Pipeline started | ticketKey, threadId, timestamp | State file + Output Channel | Session |
| Node completed | nodeId, duration, status, output summary | State file | Until archive |
| Approval action | decision, feedback text, timestamp, gate ID | State file | Until archive |
| Error occurred | code, message, nodeId, stack trace | State file + Output Channel | Session |
| State persisted | threadId, file size, checkpoint count | Output Channel (debug) | Session |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Streaming feels real-time | Latency from node emit to Chat Panel render <= 200ms |
| Performance | Extension startup not degraded | LangGraph lazy-init adds <= 500ms to activation time |
| Performance | Chat Panel responsive | Single message render (with markdown) <= 100ms |
| Performance | State persistence fast | Checkpoint write <= 200ms for typical state (< 1MB) |
| Reliability | State never lost on normal shutdown | 100% persistence guarantee on File > Close Window |
| Reliability | Crash recovery | >= 95% state recovery after unexpected extension host crash |
| Reliability | MCP reconnection | Auto-retry MCP connection 3 times with exponential backoff |
| Scalability | Long conversations | >= 200 messages without scroll/render performance degradation |
| Scalability | Full pipeline | >= 10 graph nodes without routing performance issues |
| Scalability | Concurrent pipelines | Support 1 active pipeline per workspace (queue additional) |
| Usability | Narrow sidebar | Chat Panel fully functional at 250px width minimum |
| Usability | Theme integration | Correct rendering in VS Code light, dark, and high-contrast themes |
| Usability | Keyboard accessible | All actions reachable via keyboard (Tab navigation, Enter to send) |
| Compatibility | VS Code version | Works on VS Code >= 1.85 (engine constraint in package.json) |
| Compatibility | Node.js runtime | LangGraph.js requires Node.js >= 18 |
| Bundle Size | Lightweight extension | LangGraph adds <= 500KB to bundled extension (tree-shaken via esbuild) |
| Maintainability | Modular code | Each node in separate file, shared interfaces in state.ts |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Code | Scenario | Severity | User Message | Expected Behavior |
|------|----------|----------|-------------|-------------------|
| MCP_UNREACHABLE | MCP server not running or crashed | Critical | "MCP server is not available. Use 'Kiro SDLC: Restart MCP Server' to start it." | Pipeline pauses, retry button in chat |
| MCP_TIMEOUT | Single tool call exceeds 60s | Warning | "Agent is taking longer than expected. Retrying..." | Auto-retry once, then pause with manual retry |
| NODE_TIMEOUT | Total node execution exceeds 300s | Warning | "[Agent Name] timed out after 5 minutes. [Retry] [Skip]" | Offer retry or skip to next node |
| STATE_CORRUPT | Persisted JSON parse fails | Warning | "Pipeline state was corrupted. Starting fresh." | Delete state file, clear chat, fresh start |
| STATE_TOO_LARGE | State exceeds 5MB | Info | (silent) | Auto-trim agentOutputs and archive old messages |
| GRAPH_ERROR | LangGraph internal exception | Critical | "Pipeline error. Details in Output panel." | Full stack trace to Output channel, pause graph |
| STREAM_STALL | No stream events for 30s | Info | "Still processing... (complex operation in progress)" | Animated indicator, no user action needed |
| NODE_FAILED | Node throws unhandled error | Warning | "[Agent] encountered an error: [msg]. [Retry] [Skip]" | Log error, show retry/skip options |
| WEBVIEW_DISPOSED | Panel closed during operation | Info | (none - user closed it intentionally) | Pipeline continues in background, buffer messages |
| APPROVAL_STALE | Pending approval for > 24h | Info | "Reminder: Pipeline waiting for your approval since [time]." | VS Code notification + chat badge |
| INVALID_INPUT | User command cannot be parsed | Info | "Could not understand command. Try: [ticket-key] [action]" | Show help text in chat |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Pipeline completed successfully | Developer | Chat Panel system message + VS Code info notification | Immediate |
| Approval needed at quality gate | Developer | Chat Panel approval card + Activity Bar badge | Immediate |
| Critical error (pipeline stopped) | Developer | VS Code error notification + Chat Panel error message | Immediate |
| Warning (auto-recovered) | Developer | Chat Panel inline warning (yellow) | Immediate |
| Resume available (on activate) | Developer | Chat Panel resume banner | On extension activation |
| Approval reminder (stale) | Developer | VS Code notification | After 24h of pending approval |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Execute basic BRD pipeline | "KSA-210 tao BRD" in chat | SM->BA nodes execute, BRD.md created, quality gate shown | High |
| TC-02 | Chat Panel message round-trip | Type and send message | User bubble rendered, postMessage sent, response received | High |
| TC-03 | Streaming typewriter rendering | Node emits 20 tokens over 2s | Tokens appear progressively, no flicker, final markdown | High |
| TC-04 | Quality gate approve flow | Pipeline reaches BA gate, click Approve | Graph resumes to next node, approval card dismissed | High |
| TC-05 | Quality gate reject with feedback | Click Reject, type "needs more detail" | Graph routes back to BA, feedback in state | High |
| TC-06 | State persistence and resume | Execute 2 nodes, restart VS Code | Resume banner shown, Resume restores full state | High |
| TC-07 | MCP server offline handling | Start pipeline with MCP stopped | MCP_UNREACHABLE error, retry button, no crash | High |
| TC-08 | Graph visualization node colors | Pipeline through SM->BA->SA | Colors: SM=green, BA=green, SA=blue(active), rest=gray | Medium |
| TC-09 | Minimum panel width (250px) | Resize sidebar to 250px | All elements visible, no horizontal overflow | Medium |
| TC-10 | Dark and light theme switching | Toggle VS Code color theme | Chat Panel adapts colors (CSS variables) | Medium |
| TC-11 | Concurrent stream handling | Two rapid successive messages | Messages queued, processed in order, no interleave | Medium |
| TC-12 | State corruption recovery | Manually corrupt JSON state file | Graceful error message, fresh start offered | Medium |
| TC-13 | Node timeout (60s tool call) | Mock MCP responding after 65s | Timeout error after 60s, auto-retry once | Medium |
| TC-14 | Chat history limit (200 msgs) | Send 250 messages in session | Only latest 200 in memory, older archived | Low |
| TC-15 | Cancel active stream | Click cancel during streaming | Stream stops, partial message preserved with "[cancelled]" | Low |
| TC-16 | Multiple pipeline resume options | Persist 2 different ticket pipelines | Selection list shown, correct one resumes | Low |
| TC-17 | Extension activation performance | Measure activate() duration | LangGraph adds <= 500ms vs baseline | Low |

---

## 11. UI Specifications

### 11.1 Chat Panel Layout Structure

| No. | Element | Type | Required | Behavior | Validation/Constraint |
|-----|---------|------|----------|----------|----------------------|
| 1 | Status Header | Fixed top bar | Yes | Shows: pipeline status badge + ticket key + MCP indicator | Always visible, 32px height |
| 2 | Graph Section | Collapsible container | No | Mini SVG graph with nodes/edges, toggle via chevron icon | Default collapsed; auto-expand on first pipeline run |
| 3 | Message List | Scrollable flex container | Yes | Chat messages auto-scroll to bottom on new message | Virtual scroll for > 50 messages |
| 4 | User Message Bubble | Right-aligned div | Yes | Background: var(--vscode-inputOption-activeBackground); timestamp bottom-right | Max-width: 85% of container |
| 5 | Agent Message Bubble | Left-aligned div | Yes | Agent name badge (colored), markdown rendered body, timestamp | Supports: code blocks, lists, bold, links |
| 6 | Streaming Indicator | Animated element | Yes | Three-dot pulse animation inside active agent bubble | Visible only while stream active |
| 7 | Approval Card | Elevated card | Conditional | Shadow border, summary text, action buttons row | Only when approvalRequired=true |
| 8 | Feedback Textarea | Expandable input | Conditional | Appears after [Reject] click, placeholder "Describe what to fix..." | Min 10 chars to enable Submit |
| 9 | Resume Banner | Top overlay banner | Conditional | Yellow background, ticket info, [Resume] [Start Fresh] buttons | On activate with persisted state only |
| 10 | Input Container | Fixed bottom section | Yes | Textarea (auto-grow, max 4 lines) + Send icon button | Disabled during approval wait state |
| 11 | Send Button | Icon button (paper-plane) | Yes | Enabled when input.trim().length > 0, click or Enter to send | Shift+Enter for newline |
| 12 | System Message | Center-aligned, muted text | Yes | Pipeline status changes, errors, info messages | Smaller font, --vscode-descriptionForeground |

### 11.2 Graph Visualization Specification

| Node ID | Label | Position (LR layout) | Colors by State |
|---------|-------|---------------------|-----------------|
| sm | SM | Column 1 (x: 0) | pending=#808080, active=#4A90D9 pulse, done=#4CAF50, error=#F44336, paused=#FFC107 |
| ba | BA | Column 2 (x: 80) | Same color scheme |
| sa | SA | Column 3 (x: 160) | Same color scheme |
| qa | QA | Column 4 (x: 240) | Same color scheme |
| dev | DEV | Column 5 (x: 320) | Same color scheme |
| devops | DevOps | Column 6 (x: 400) | Same color scheme |

Edges: directed arrows between nodes (solid for direct routing, dashed for conditional). Active edge: highlighted blue.

### 11.3 Responsive Breakpoints

| Panel Width | Layout Adjustment |
|-------------|-------------------|
| >= 500px | Full horizontal graph, side-by-side elements |
| 350-499px | Graph nodes smaller (24px), shortened labels |
| 250-349px | Graph stacked vertically, single column, compact bubbles |
| < 250px | Not supported (VS Code minimum sidebar width) |

---

## 12. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence - Chat Flow | [sequence-chat-flow.png](diagrams/sequence-chat-flow.png) | [sequence-chat-flow.drawio](diagrams/sequence-chat-flow.drawio) |
| 3 | State - Pipeline Phases | [state-pipeline.png](diagrams/state-pipeline.png) | [state-pipeline.drawio](diagrams/state-pipeline.drawio) |

### Change Log from BRD

- BRD specified 6 user stories; FSD maps them to UC-01 through UC-06 with full Main/Alternative/Exception flows
- BRD state schema expanded with supporting types (DocumentState, AgentOutput, ChatMessage, PipelineError, etc.)
- BRD UI Specifications table expanded with element-level behavior, validation, and responsive breakpoints
- Added postMessage protocol specification (bidirectional message types with payloads)
- Added MCP tool mapping per node (derived from existing MCP server architecture in engine.ts)
- Added CSP details derived from existing BasePanel pattern in kiro-sdlc-agents/src/panels/base-panel.ts
- Added conditional routing pseudocode (routeFromSm, routeAfterNode, routeAfterApproval)
- Added WorkspaceCheckpointer processing logic for atomic state persistence
- Quality gate table expanded with specific artifacts and summaries per gate
