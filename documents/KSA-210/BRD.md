# Business Requirements Document (BRD)

## Kiro SDLC Agents — KSA-210: LangGraph.js Integration with Chat Panel

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-210 |
| Title | LangGraph.js Integration with Chat Panel |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SM Agent – Scrum Master | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-210 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Tích hợp LangGraph.js vào VS Code extension `kiro-sdlc-agents` (v1.15.0) để:

1. **LangGraph Core StateGraph Orchestration** — Thay thế/bổ sung orchestration engine hiện tại bằng LangGraph.js StateGraph, cho phép quản lý multi-agent SDLC pipeline (SM → BA → SA → QA → DEV → DevOps) với typed state, conditional routing, và human-in-the-loop checkpoints
2. **Chat Panel WebviewView Sidebar** — Tạo Chat Panel hiển thị ở VS Code sidebar (phải), cho phép user tương tác với agent pipeline qua giao diện chat, xem graph visualization, và approve/reject tại quality gates

Extension hiện tại giao tiếp với MCP server `mcp-code-intelligence-nodejs` (port 9181) có orchestration engine, memory, và graph modules. LangGraph.js nodes sẽ wrap MCP tool calls để tận dụng infrastructure hiện có.

### 1.2 Out of Scope

- Thay đổi MCP server core logic (chỉ consume API, không modify server)
- Migration dữ liệu từ MCP orchestration engine sang LangGraph (coexist strategy)
- Thay đổi Jira integration (giữ nguyên flow hiện tại)
- Mobile/web client (chỉ VS Code extension)
- Thay đổi document templates (BRD, FSD, TDD format giữ nguyên)
- Training/fine-tuning LLM models

### 1.3 Preliminary Requirement

- VS Code extension `kiro-sdlc-agents` v1.15.0 đang hoạt động ổn định
- MCP server `mcp-code-intelligence-nodejs` running ở port 9181
- Node.js ≥18 (LangGraph.js requirement)
- Dependencies: `@langchain/langgraph`, `@langchain/core` available trên npm
- VS Code API `WebviewView` available (VS Code ≥1.70)
- Kiro IDE hỗ trợ sub-agent invocation

---

## 2. Business Requirements

### 2.1 High Level Process Map

**Current State:**
- SM agent nhận ticket key từ user
- SM dispatch sub-agents tuần tự qua `invokeSubAgent`
- Không có visual feedback về pipeline state
- User phải đọc terminal/output panel để theo dõi progress
- Không có persistent state — restart mất context

**Target State:**
- User mở Chat Panel ở sidebar phải
- Gõ ticket key hoặc command trong chat
- LangGraph StateGraph orchestrate pipeline: SM → BA → SA → ...
- Chat Panel streaming real-time responses từ agents
- Graph visualization hiển thị trạng thái nodes (active/done/pending)
- Human-in-the-loop: user approve/reject tại quality gates qua chat buttons
- State persist — resume pipeline sau restart

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case / Epic | Priority | Source Ticket |
|---|-------------------------|----------|---------------|
| 1 | As a developer, I want a LangGraph StateGraph that orchestrates the SM → BA → SA agent flow so that pipeline execution is structured and resumable | MUST HAVE | KSA-210 |
| 2 | As a developer, I want a Chat Panel in the VS Code sidebar so that I can interact with the agent pipeline via a familiar chat interface | MUST HAVE | KSA-210 |
| 3 | As a developer, I want agent responses to stream in real-time in the Chat Panel so that I get immediate feedback on pipeline progress | MUST HAVE | KSA-210 |
| 4 | As a developer, I want a graph visualization showing node states so that I can see which agents are active, done, or pending | SHOULD HAVE | KSA-210 |
| 5 | As a developer, I want human-in-the-loop approval at quality gates so that I can approve or reject pipeline transitions via the chat interface | MUST HAVE | KSA-210 |
| 6 | As a developer, I want pipeline state to persist across VS Code restarts so that I can resume work without losing progress | MUST HAVE | KSA-210 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer mở VS Code workspace với kiro-sdlc-agents extension active

**Step 2:** Chat Panel tự động hiển thị ở sidebar phải (hoặc user click icon để open)

**Step 3:** Developer gõ ticket key trong chat input (ví dụ: `KSA-210 tạo BRD`)

**Step 4:** Extension parse input → khởi tạo LangGraph StateGraph với initial state

**Step 5:** StateGraph route tới SM node → SM node xác định phase → route tới BA node

**Step 6:** BA node wrap MCP tool calls → invoke BA agent qua MCP server

**Step 7:** Chat Panel stream response real-time (token by token hoặc chunk)

**Step 8:** Graph visualization update: SM=done, BA=active, SA=pending

**Step 9:** BA node complete → StateGraph check quality gate → pause cho human approval

**Step 10:** Chat Panel hiển thị approval buttons: [Approve] [Reject] [Feedback]

**Step 11:** Developer click Approve → StateGraph resume → route tới next node

**Step 12:** Nếu developer click Reject/Feedback → StateGraph loop back → agent redo với feedback

**Step 13:** State persist vào workspace storage → developer restart VS Code → resume từ Step 9

> **Note:** Graph chỉ advance khi quality gate pass. Mỗi phase transition là một checkpoint có thể resume.

---

#### STORY 1: LangGraph StateGraph Orchestration (SM → BA → SA Flow)

> As a developer, I want a LangGraph StateGraph that orchestrates the SM → BA → SA agent flow so that pipeline execution is structured and resumable

**Requirement Details:**

1. Implement LangGraph.js StateGraph với typed state interface (TypeScript)
2. State chứa: ticket info, current phase, documents created, agent outputs, approval status
3. Nodes: SM, BA, TA, SA, QA, DEV, DevOps — mỗi node wrap MCP tool calls
4. Conditional edges: route dựa trên current phase và quality gate results
5. Checkpoints: sau mỗi node complete → persist state → có thể resume
6. MCP integration: mỗi node gọi MCP server (port 9181) để execute actual agent logic
7. Error handling: node failure → state update với error → route tới error handling node

**State Schema:**

| Field | Type | Description |
|-------|------|-------------|
| ticketKey | string | Jira ticket key (e.g., KSA-210) |
| currentPhase | string | Current SDLC phase (requirements/specification/design/...) |
| pipelineStatus | string | running/paused/completed/failed |
| documents | Record<string, DocState> | Map of documents: {brd: {status, version, path}} |
| agentOutputs | AgentOutput[] | Array of agent responses (streaming chunks) |
| approvalRequired | boolean | Whether human approval needed at current checkpoint |
| approvalDecision | string | null/approved/rejected/feedback |
| userFeedback | string | Optional feedback from user when rejecting |
| errors | Error[] | Array of errors encountered |
| resumePoint | string | Node ID to resume from after restart |

**Acceptance Criteria:**

1. StateGraph successfully orchestrates SM → BA → SA flow for a ticket
2. Each node correctly wraps MCP tool calls and receives responses
3. State persists between node transitions (checkpoint mechanism)
4. Conditional routing works: phase detection → correct next node
5. Error in one node does not crash entire graph — graceful error state
6. Graph can be paused at any checkpoint and resumed later
7. State serializable to JSON for persistence

---

#### STORY 2: Chat Panel WebviewView Sidebar

> As a developer, I want a Chat Panel in the VS Code sidebar so that I can interact with the agent pipeline via a familiar chat interface

**Requirement Details:**

1. Implement `WebviewViewProvider` cho Chat Panel
2. Register trong VS Code sidebar (Activity Bar hoặc Secondary Sidebar)
3. Chat UI: message list (user messages + agent responses), input box, send button
4. Extension ↔ Webview communication via `postMessage` API
5. Theme-aware: follow VS Code color theme (light/dark)
6. Responsive layout: resize theo panel width

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Chat Message List | Container | Yes | Scrollable list hiển thị conversation history | Auto-scroll to bottom on new message |
| 2 | User Message Bubble | Component | Yes | Hiển thị user input với timestamp | Align right, background color distinct |
| 3 | Agent Message Bubble | Component | Yes | Hiển thị agent response với agent name tag | Align left, markdown rendering |
| 4 | Input Box | Textarea | Yes | Multi-line input cho user commands/messages | Enter to send, Shift+Enter for newline |
| 5 | Send Button | Button | Yes | Gửi message | Disabled khi input empty |
| 6 | Status Indicator | Badge | Yes | Hiển thị pipeline status (Running/Paused/Idle) | Top-right corner |
| 7 | Graph Visualization | Canvas/SVG | No | Mini graph showing node states | Collapsible section |
| 8 | Approval Buttons | Button Group | Conditional | [Approve] [Reject] [Feedback] | Chỉ hiển thị khi approvalRequired=true |
| 9 | Feedback Input | Textarea | Conditional | Input cho rejection feedback | Chỉ hiển thị khi user click Reject |

**Acceptance Criteria:**

1. Chat Panel registers và hiển thị trong VS Code sidebar (Activity Bar icon)
2. User có thể gõ message và nhận response từ agent pipeline
3. Message history persist trong session (không mất khi panel collapse/expand)
4. UI responsive — works với panel width từ 250px đến 600px
5. Theme-aware — correct colors trong cả light và dark theme
6. Markdown rendering trong agent messages (code blocks, lists, bold)

---

#### STORY 3: Real-time Streaming Agent Responses

> As a developer, I want agent responses to stream in real-time in the Chat Panel so that I get immediate feedback on pipeline progress

**Requirement Details:**

1. LangGraph nodes emit streaming events khi agent đang process
2. Extension forward streaming events tới Webview via postMessage
3. Chat Panel render partial response (typewriter effect)
4. Support multiple concurrent streams (nếu parallel nodes active)
5. Stream includes: text content, progress indicators, status updates

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| streamId | string | Yes | Unique ID cho mỗi stream session | "stream-ba-001" |
| nodeId | string | Yes | Node đang emit stream | "ba-node" |
| type | enum | Yes | Type of stream event | "token" / "status" / "complete" / "error" |
| content | string | Yes | Content of event | "Analyzing requirements..." |
| timestamp | number | Yes | Unix timestamp ms | 1706345678000 |
| metadata | object | No | Additional context | {phase: "requirements", progress: 45} |

**Acceptance Criteria:**

1. Agent responses appear in chat within 200ms of emission (low latency)
2. Typewriter effect smooth — no flickering or layout jumps
3. User can see partial response while agent is still processing
4. Multiple streams render correctly (each in own message bubble)
5. Stream completion triggers: final message render, status update, graph update
6. Network interruption → stream resumes or shows error gracefully

---

#### STORY 4: Graph Visualization of Node States

> As a developer, I want a graph visualization showing node states so that I can see which agents are active, done, or pending

**Requirement Details:**

1. Mini graph visualization trong Chat Panel (collapsible section)
2. Nodes represent SDLC agents: SM, BA, TA, SA, QA, DEV, DevOps
3. Edges represent flow direction (conditional routing visible)
4. Node states: pending (gray), active (blue pulse), done (green), error (red), paused (yellow)
5. Real-time update khi graph state changes
6. Click node → show node details (last output, duration, status)

**Acceptance Criteria:**

1. Graph renders correctly with all nodes and edges
2. Node colors update in real-time as graph executes
3. Active node has visible animation (pulse or glow)
4. Graph layout adapts to panel width (horizontal for wide, vertical for narrow)
5. Click interaction works — shows node detail tooltip/popover
6. Graph state matches actual LangGraph execution state (no desync)

---

#### STORY 5: Human-in-the-Loop at Quality Gates

> As a developer, I want human-in-the-loop approval at quality gates so that I can approve or reject pipeline transitions via the chat interface

**Requirement Details:**

1. LangGraph StateGraph pause tại defined checkpoints (quality gates)
2. Chat Panel hiển thị approval UI: buttons + context summary
3. Approval actions: Approve (continue), Reject (redo with feedback), Skip (proceed without approval)
4. Feedback mechanism: user provide text feedback khi rejecting
5. Timeout: nếu không approve trong configurable time → auto-pause (không auto-approve)

**Quality Gate Checkpoints:**

| Checkpoint | After Node | Context Shown | Actions |
|-----------|-----------|---------------|---------|
| BRD Review | BA node | BRD summary, key user stories | Approve / Reject / Edit |
| FSD Review | TA node | FSD summary, API contracts | Approve / Reject / Edit |
| TDD Review | SA node | TDD summary, architecture decisions | Approve / Reject / Edit |
| Code Review | DEV node | Code diff summary, test results | Approve / Reject / Edit |
| Test Results | QA node | Test pass/fail summary | Approve / Reject / Rerun |

**Acceptance Criteria:**

1. Graph pauses correctly at each quality gate checkpoint
2. Approval UI appears only when checkpoint reached (not premature)
3. Approve action resumes graph execution to next node
4. Reject action with feedback → graph routes back to previous node with feedback context
5. State after approval/rejection correctly persisted (resume-safe)
6. Multiple quality gates in sequence work correctly (no skip)

---

#### STORY 6: Persistent State — Resume Pipeline After Restart

> As a developer, I want pipeline state to persist across VS Code restarts so that I can resume work without losing progress

**Requirement Details:**

1. LangGraph state serialize to JSON và store trong VS Code workspace storage
2. On extension activate → check for persisted state → offer resume option
3. Resume restores: graph position, documents created, approval status, chat history
4. Conflict detection: nếu files on disk khác với persisted state → warn user
5. Cleanup: completed pipelines auto-archive sau configurable time

**Acceptance Criteria:**

1. State persists khi VS Code restart (normal close + crash)
2. Resume từ exact checkpoint (không re-execute completed nodes)
3. Chat history restored on resume (user sees previous conversation)
4. Graph visualization restored to correct state on resume
5. Conflict detection works: warns if BRD.md on disk differs from state
6. Manual clear: user có thể reset state nếu muốn start fresh

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| @langchain/langgraph | External Package | N/A | LangGraph.js core library for StateGraph |
| @langchain/core | External Package | N/A | LangChain core (required by langgraph) |
| MCP Server (port 9181) | System | N/A | mcp-code-intelligence-nodejs phải running để nodes gọi tools |
| VS Code WebviewView API | System | N/A | VS Code ≥1.70 required cho sidebar webview |
| kiro-sdlc-agents v1.15.0 | Internal | N/A | Extension hiện tại — LangGraph tích hợp vào đây |
| Node.js ≥18 | Runtime | N/A | LangGraph.js yêu cầu Node 18+ |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | User | Define requirements, approve design decisions | Ticket reporter |
| Architect | SA Agent | Design LangGraph integration architecture | Pipeline |
| Developer | DEV Agent | Implement StateGraph, Chat Panel, streaming | Pipeline |
| QA | QA Agent | Test pipeline flow, UI, state persistence | Pipeline |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| LangGraph.js bundle size too large for extension | High | Medium | Tree-shake, lazy load, measure bundle impact |
| MCP tool call latency causes poor streaming UX | Medium | Medium | Buffer + debounce, show loading indicators |
| State serialization fails for complex objects | Medium | Low | Use JSON-safe types only in state, test serialization |
| WebviewView memory leak with long chat history | Medium | Medium | Virtual scrolling, message pagination, max history limit |
| LangGraph version updates break API | Medium | Low | Pin exact version, comprehensive integration tests |
| VS Code extension host crash under heavy streaming | High | Low | Throttle events, batch postMessage calls |

### 5.2 Assumptions

- LangGraph.js stable enough for production use (v0.2+)
- MCP server supports concurrent tool calls from multiple graph nodes
- VS Code WebviewView API supports streaming postMessage without throttling
- Extension bundle size budget allows additional ~500KB for LangGraph dependencies
- User has stable network for MCP server communication (localhost)
- Chat Panel UI can be built with vanilla HTML/CSS/JS (no heavy framework needed in webview)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Streaming latency ≤200ms | Time from agent emit to chat panel render |
| Performance | Extension activation time increase ≤500ms | LangGraph initialization must be fast |
| Performance | Chat Panel render ≤100ms per message | Smooth UX even with markdown rendering |
| Reliability | State persistence 100% on normal shutdown | No data loss on File → Close |
| Reliability | Crash recovery ≥95% | Recover state after unexpected extension host crash |
| Scalability | Support ≥50 messages in chat history | Without performance degradation |
| Scalability | Support ≥10 graph nodes | StateGraph should handle full SDLC pipeline |
| Security | No secrets in persisted state | API keys, tokens must not be serialized |
| Security | Webview CSP (Content Security Policy) | Prevent XSS in chat panel |
| Usability | Chat Panel usable at 250px width | Minimum viable width for sidebar |
| Compatibility | VS Code ≥1.70 | Minimum version for WebviewView API |
| Compatibility | Node.js ≥18 | LangGraph.js runtime requirement |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-210 | LangGraph.js Integration with Chat Panel | To Do | Task | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| LangGraph.js | JavaScript/TypeScript library for building stateful, multi-agent applications with graph-based orchestration |
| StateGraph | LangGraph's primary abstraction — directed graph where nodes are functions and edges define control flow |
| WebviewView | VS Code API cho rendering custom HTML UI trong sidebar/panel areas |
| MCP (Model Context Protocol) | Protocol cho communication giữa AI tools và host applications |
| Human-in-the-loop (HITL) | Pattern where automated workflow pauses for human decision/approval |
| Checkpoint | A persist point trong graph execution — cho phép resume sau interrupt |
| postMessage | VS Code API cho bi-directional communication giữa extension host và webview |
| Quality Gate | Defined checkpoint trong SDLC pipeline yêu cầu approval trước khi proceed |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| LangGraph.js Documentation | https://langchain-ai.github.io/langgraphjs/ |
| VS Code WebviewView API | https://code.visualstudio.com/api/references/vscode-api#WebviewView |
| MCP Server (code-intelligence) | mcp-code-intelligence-nodejs/ |
| kiro-sdlc-agents Extension | kiro-sdlc-agents/ |
| VS Code Extension API | https://code.visualstudio.com/api |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow — LangGraph Chat Pipeline | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case — Chat Panel Interactions | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
