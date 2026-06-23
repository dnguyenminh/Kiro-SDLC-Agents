# Technical Design Document (TDD)

## kiro-ts — KSA-236: tool_use_id mismatch causes 400 on ReAct tool continuation

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-236 |
| Title | kiro-ts: tool_use_id mismatch causes 400 on ReAct tool continuation |
| Author | SA Agent |
| Version | 2.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-236.docx |
| Related FSD | FSD-v1-KSA-236.docx |
| Tech Stack | Node.js / TypeScript / Express + SSE |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | SA Agent - Solution Architect | Create document |
| Peer Reviewer | Duc Nguyen Minh - Reporter | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | SA Agent | Initial Rust-based TDD |
| 2.0 | 2025-07-14 | SA Agent | Rewrite for Node.js/TypeScript tech stack |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the technical design in this TDD |
| | ☐ I agree and confirm the technical design in this TDD |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies HOW to implement the `tool_use_id` passthrough fix in the kiro-ts Anthropic converter module. The fix ensures that the original `tool_use_id` from the Kiro Q API response is passed through unchanged to: (a) the SSE streaming response sent to the VS Code extension client, and (b) the in-memory conversation history.

> **Scope Boundary:** This TDD does NOT repeat functional requirements or business rules — refer to the FSD for those. This document focuses on: root cause analysis, code change design, implementation patterns, and testing strategy.

### 1.2 Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Language | TypeScript | 5.x |
| Runtime | Node.js | 20.x LTS |
| HTTP Framework | Express | 4.x |
| SSE Streaming | Native `res.write()` with Express | — |
| Testing | Vitest + supertest | latest |
| Package Manager | npm | 10.x |
| Linting | ESLint + Prettier | latest |
| Build | tsc (TypeScript compiler) | 5.x |

### 1.3 Design Principles

1. **Passthrough over Transform** — IDs from Kiro Q API flow through unchanged; no mapping tables, no regeneration
2. **Single Source of Truth** — The Kiro Q API response `content[].id` field IS the canonical `tool_use_id`
3. **Fail Fast with Diagnostics** — When mismatch occurs, log actionable info immediately
4. **Zero Breaking Changes** — SSE stream format to extension remains identical
5. **Minimal Diff** — Fix targets exactly 2 files with surgical precision

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-236/BRD.md |
| FSD | documents/KSA-236/FSD.md |
| Source (converter) | src/anthropic/converter.ts |
| Source (handlers) | src/anthropic/handlers.ts |

---

## 2. System Architecture

### 2.1 High-Level Architecture

![Architecture Diagram](diagrams/architecture.png)
*[Edit in draw.io](diagrams/architecture.drawio)*

The kiro-ts service operates as a streaming proxy between the VS Code extension and the Kiro Q API:

```
┌──────────────┐     SSE Stream     ┌──────────────┐      HTTP/JSON      ┌──────────────┐
│   VS Code    │◄──────────────────►│   kiro-ts    │◄────────────────────►│  Kiro Q API  │
│  Extension   │   (tool_use_id     │   (Express)  │    (tool_use_id      │   Backend    │
│   Client     │    passthrough)    │              │     originates)      │              │
└──────────────┘                    └──────────────┘                      └──────────────┘
```

### 2.2 Module Structure

```
src/
├── anthropic/
│   ├── converter.ts          ← PRIMARY FIX TARGET
│   ├── handlers.ts           ← SECONDARY FIX TARGET
│   ├── types.ts              ← Shared type definitions
│   └── __tests__/
│       ├── converter.test.ts
│       └── handlers.test.ts
├── history/
│   ├── conversation.ts       ← In-memory history store
│   └── types.ts
├── server.ts                 ← Express app setup
├── routes.ts                 ← Route definitions
└── index.ts                  ← Entry point
```

### 2.3 Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| `converter.ts` | Transforms Kiro Q response format ↔ Anthropic SSE format. **Root cause location** |
| `handlers.ts` | Express route handler for `/chat/completions`. Orchestrates request/response flow |
| `conversation.ts` | Stores conversation messages in-memory with tool_use_id correlation |
| `types.ts` | TypeScript interfaces for Kiro Q and Anthropic message formats |

---

## 3. API Design

### 3.1 Endpoint: POST /chat/completions

**Implements:** UC-1 (ReAct Tool Loop), UC-2 (Diagnostic Error)

#### Request (Initial Chat)

```json
{
  "messages": [
    { "role": "user", "content": "Read file X and analyze it" }
  ],
  "tools": [
    { "name": "readFile", "description": "...", "input_schema": {...} }
  ]
}
```

#### Request (Continuation with Tool Result)

```json
{
  "messages": [
    { "role": "user", "content": "Read file X and analyze it" },
    { "role": "assistant", "content": [{ "type": "tool_use", "id": "tooluse_ABC123", "name": "readFile", "input": {"path": "/src/main.ts"} }] },
    { "role": "user", "content": [{ "type": "tool_result", "tool_use_id": "tooluse_ABC123", "content": "file contents..." }] }
  ]
}
```

#### Response (SSE Stream)

```
event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tooluse_ABC123","name":"readFile","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"path\":\"/src/main.ts\"}"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_stop
data: {"type":"message_stop"}
```

**Critical Invariant (BR-1, BR-2):** The `id` field in `content_block_start` MUST be the exact same string returned by Kiro Q API — no transformation.

#### Error Response (UC-2 — Mismatch)

```json
{
  "error": {
    "type": "tool_use_id_mismatch",
    "message": "Tool continuation failed: tool_use_id 'tooluse_WRONG' not found in conversation history. Available IDs: ['tooluse_ABC123', 'tooluse_DEF456']",
    "received_id": "tooluse_WRONG",
    "available_ids": ["tooluse_ABC123", "tooluse_DEF456"],
    "turn_number": 3
  }
}
```

HTTP Status: `400 Bad Request` with descriptive body (BR-8).

---

## 4. Database Design

Not applicable — this feature uses in-memory conversation history only (no persistent storage). See Section 5 for the in-memory data model.

---

## 5. Class/Module Design

### 5.1 Component Diagram

![Component Diagram](diagrams/component.png)
*[Edit in draw.io](diagrams/component.drawio)*

### 5.2 Type Definitions (`src/anthropic/types.ts`)

```typescript
// --- Kiro Q API Response Types ---

export interface KiroQResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: KiroQContentBlock[];
  stop_reason: "tool_use" | "end_turn" | null;
}

export interface KiroQToolUseBlock {
  type: "tool_use";
  id: string;        // ← THE tool_use_id to preserve (BR-1)
  name: string;
  input: Record<string, unknown>;
}

export interface KiroQTextBlock {
  type: "text";
  text: string;
}

export type KiroQContentBlock = KiroQToolUseBlock | KiroQTextBlock;

// --- Anthropic SSE Stream Types ---

export interface ContentBlockStartEvent {
  type: "content_block_start";
  index: number;
  content_block: {
    type: "tool_use" | "text";
    id?: string;       // ← MUST equal KiroQToolUseBlock.id (BR-2)
    name?: string;
    input?: Record<string, unknown>;
  };
}

export interface ContentBlockDeltaEvent {
  type: "content_block_delta";
  index: number;
  delta: {
    type: "input_json_delta" | "text_delta";
    partial_json?: string;
    text?: string;
  };
}

export interface ContentBlockStopEvent {
  type: "content_block_stop";
  index: number;
}

export interface MessageStopEvent {
  type: "message_stop";
}

export type SSEEvent =
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageStopEvent;

// --- Conversation History Types ---

export interface ConversationMessage {
  role: "user" | "assistant" | "tool_result";
  content: ContentBlock[];
  turnNumber: number;
}

export interface ToolUseContentBlock {
  type: "tool_use";
  id: string;          // ← Preserved from API (BR-1)
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContentBlock {
  type: "tool_result";
  toolUseId: string;   // ← Must match a stored ToolUseContentBlock.id (BR-2)
  content: string;
  isError?: boolean;
}

export interface TextContentBlock {
  type: "text";
  text: string;
}

export type ContentBlock = ToolUseContentBlock | ToolResultContentBlock | TextContentBlock;

// --- Continuation Request Types ---

export interface ContinuationRequest {
  messages: Array<{
    role: string;
    content: string | ContentBlock[];
  }>;
  toolResult?: {
    toolUseId: string;
    content: string;
    isError?: boolean;
  };
}
```

### 5.3 Converter Module (`src/anthropic/converter.ts`)

**This is the PRIMARY fix target.** The converter transforms Kiro Q responses into SSE events.

```typescript
import { KiroQResponse, KiroQToolUseBlock, SSEEvent, ContentBlockStartEvent } from './types';
import { logger } from '../logger';

/**
 * Convert a Kiro Q API response into a sequence of SSE events.
 * 
 * CRITICAL (BR-1): The tool_use_id from the API response MUST be passed
 * through UNCHANGED. No new ID generation, no mapping, no transformation.
 */
export function convertResponseToSSEEvents(response: KiroQResponse): SSEEvent[] {
  const events: SSEEvent[] = [];

  response.content.forEach((block, index) => {
    if (block.type === 'tool_use') {
      // ═══════════════════════════════════════════════════
      // FIX: Use block.id directly — DO NOT generate new ID
      // OLD (buggy): id: generateToolUseId()  ← REMOVED
      // NEW (fixed): id: block.id             ← PASSTHROUGH
      // ═══════════════════════════════════════════════════
      
      logger.trace('tool_use_id passthrough', {
        originalId: block.id,
        toolName: block.name,
        blockIndex: index,
      });

      const startEvent: ContentBlockStartEvent = {
        type: 'content_block_start',
        index,
        content_block: {
          type: 'tool_use',
          id: block.id,        // ← PASSTHROUGH (BR-1)
          name: block.name,
          input: {},
        },
      };
      events.push(startEvent);

      // Stream tool input as delta
      events.push({
        type: 'content_block_delta',
        index,
        delta: {
          type: 'input_json_delta',
          partial_json: JSON.stringify(block.input),
        },
      });

      events.push({ type: 'content_block_stop', index });
    } else if (block.type === 'text') {
      events.push({
        type: 'content_block_start',
        index,
        content_block: { type: 'text' },
      });

      events.push({
        type: 'content_block_delta',
        index,
        delta: { type: 'text_delta', text: block.text },
      });

      events.push({ type: 'content_block_stop', index });
    }
  });

  events.push({ type: 'message_stop' });
  return events;
}

/**
 * Extract tool_use_ids from a Kiro Q response for history storage.
 * Returns the SAME ids that will be streamed to the client.
 * 
 * CRITICAL (BR-2): These ids must EXACTLY match what convertResponseToSSEEvents produces.
 */
export function extractToolUseIds(response: KiroQResponse): string[] {
  return response.content
    .filter((block): block is KiroQToolUseBlock => block.type === 'tool_use')
    .map(block => block.id);  // ← Direct passthrough, no transformation
}

/**
 * Validate a tool_use_id format (BR-3).
 */
export function validateToolUseId(id: unknown): id is string {
  if (typeof id !== 'string' || id.length === 0) {
    return false;
  }
  return /^tooluse_[A-Za-z0-9]+$/.test(id);
}
```

### 5.4 Handler Module (`src/anthropic/handlers.ts`)

**SECONDARY fix target.** The handler orchestrates the request lifecycle.

```typescript
import { Request, Response } from 'express';
import { convertResponseToSSEEvents, extractToolUseIds, validateToolUseId } from './converter';
import { ConversationHistory } from '../history/conversation';
import { KiroQResponse, ContinuationRequest } from './types';
import { logger } from '../logger';

const history = new ConversationHistory();

/**
 * Handle POST /chat/completions
 * Implements UC-1 (ReAct Tool Loop) and UC-2 (Diagnostic Error)
 */
export async function handleChatCompletions(req: Request, res: Response): Promise<void> {
  const body = req.body as ContinuationRequest;

  // --- Step 1: Process continuation (if tool result present) ---
  if (body.toolResult) {
    const { toolUseId, content, isError } = body.toolResult;

    // Validate toolUseId exists in history (BR-2)
    const match = history.findToolUse(toolUseId);
    if (!match) {
      // UC-2: Diagnostic error on mismatch (BR-6, BR-7, BR-8)
      const availableIds = history.getAllToolUseIds();
      const turnNumber = history.getCurrentTurn();

      logger.warn('tool_use_id mismatch', {
        receivedId: toolUseId,
        availableIds,
        turnNumber,
      });

      res.status(400).json({
        error: {
          type: 'tool_use_id_mismatch',
          message: `Tool continuation failed: tool_use_id '${toolUseId}' not found in conversation history. Available IDs: [${availableIds.map(id => `'${id}'`).join(', ')}]`,
          received_id: toolUseId,
          available_ids: availableIds,
          turn_number: turnNumber,
        },
      });
      return;
    }

    // Store tool result in history
    history.addToolResult(toolUseId, content, isError ?? false);
  }

  // --- Step 2: Forward to Kiro Q API ---
  const kiroQResponse = await forwardToKiroQ(body);

  // --- Step 3: Validate response (BR-3) ---
  for (const block of kiroQResponse.content) {
    if (block.type === 'tool_use') {
      if (!validateToolUseId(block.id)) {
        logger.error('Invalid tool_use_id from API', { id: block.id });
        res.status(502).json({
          error: {
            type: 'malformed_api_response',
            message: 'Received malformed tool_use response from API (invalid/missing id field)',
          },
        });
        return;
      }
    }
  }

  // --- Step 4: Store in history with SAME IDs (BR-2) ---
  history.addAssistantMessage(kiroQResponse);

  logger.trace('tool_use_ids stored in history', {
    ids: extractToolUseIds(kiroQResponse),
    turn: history.getCurrentTurn(),
  });

  // --- Step 5: Stream SSE response (BR-1 — ID passthrough) ---
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const events = convertResponseToSSEEvents(kiroQResponse);
  for (const event of events) {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }

  res.end();
}

async function forwardToKiroQ(request: ContinuationRequest): Promise<KiroQResponse> {
  // Implementation: HTTP POST to Kiro Q API
  // ... (existing code, not part of fix)
  throw new Error('Not implemented in TDD — existing code');
}
```

### 5.5 Conversation History (`src/history/conversation.ts`)

```typescript
import { KiroQResponse, ConversationMessage, ToolUseContentBlock } from '../anthropic/types';
import { logger } from '../logger';

/**
 * In-memory conversation history store.
 * Thread-safe for Node.js single-threaded event loop (no mutex needed).
 */
export class ConversationHistory {
  private messages: ConversationMessage[] = [];
  private toolUseIndex: Map<string, ToolUseContentBlock> = new Map();
  private turnCounter = 0;

  /**
   * Store assistant message, indexing all tool_use_ids for O(1) lookup.
   * CRITICAL (BR-2): IDs stored here MUST be the same as streamed to client.
   */
  addAssistantMessage(response: KiroQResponse): void {
    this.turnCounter++;
    const blocks = response.content.map(block => {
      if (block.type === 'tool_use') {
        const toolBlock: ToolUseContentBlock = {
          type: 'tool_use',
          id: block.id,      // ← SAME id from API (BR-1, BR-2)
          name: block.name,
          input: block.input,
        };
        // Index for fast lookup on continuation
        this.toolUseIndex.set(block.id, toolBlock);
        return toolBlock;
      }
      return { type: 'text' as const, text: block.text };
    });

    this.messages.push({
      role: 'assistant',
      content: blocks,
      turnNumber: this.turnCounter,
    });
  }

  /**
   * Find a tool_use by ID. Returns null if not found (triggers UC-2).
   */
  findToolUse(toolUseId: string): ToolUseContentBlock | null {
    return this.toolUseIndex.get(toolUseId) ?? null;
  }

  /**
   * Get all stored tool_use_ids for diagnostic output (BR-7).
   */
  getAllToolUseIds(): string[] {
    return Array.from(this.toolUseIndex.keys());
  }

  /**
   * Store tool result, correlating with the original tool_use.
   */
  addToolResult(toolUseId: string, content: string, isError: boolean): void {
    this.turnCounter++;
    this.messages.push({
      role: 'tool_result',
      content: [{
        type: 'tool_result',
        toolUseId,
        content,
        isError,
      }],
      turnNumber: this.turnCounter,
    });
  }

  getCurrentTurn(): number {
    return this.turnCounter;
  }

  clear(): void {
    this.messages = [];
    this.toolUseIndex.clear();
    this.turnCounter = 0;
  }
}
```

### 5.6 Root Cause Analysis

**Bug Location:** `src/anthropic/converter.ts` — response conversion function

**Root Cause:** The converter was generating NEW `tool_use_id` values (via a `generateId()` or UUID function) when creating SSE events, instead of using the `id` field from the Kiro Q API response.

**Before (Buggy):**
```typescript
// WRONG — generates new ID, causing mismatch
const startEvent: ContentBlockStartEvent = {
  type: 'content_block_start',
  index,
  content_block: {
    type: 'tool_use',
    id: generateToolUseId(),  // ← BUG: New ID != API ID
    name: block.name,
    input: {},
  },
};
```

**After (Fixed):**
```typescript
// CORRECT — passthrough original ID
const startEvent: ContentBlockStartEvent = {
  type: 'content_block_start',
  index,
  content_block: {
    type: 'tool_use',
    id: block.id,  // ← FIX: Same ID from Kiro Q API (BR-1)
    name: block.name,
    input: {},
  },
};
```

---

## 6. Integration Design

### 6.1 Kiro Q API Integration

| Attribute | Value |
|-----------|-------|
| Protocol | HTTPS |
| Format | JSON request / JSON response |
| Auth | Service bearer token |
| Timeout | 30s |
| Retry | 1 retry on 5xx with exponential backoff |

### 6.2 VS Code Extension Integration

| Attribute | Value |
|-----------|-------|
| Protocol | HTTP/1.1 with SSE |
| Format | `text/event-stream` (server → client), JSON (client → server) |
| Connection | Keep-alive during streaming |
| Auth | User session token (passed through to Kiro Q) |

### 6.3 Sequence Diagram — ReAct Tool Loop

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Extension │     │ handlers │     │converter │     │ Kiro Q   │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │ POST /chat/completions           │                 │
     │────────────────►│                │                 │
     │                 │ forwardToKiroQ()                  │
     │                 │─────────────────────────────────►│
     │                 │              KiroQResponse        │
     │                 │◄─────────────────────────────────│
     │                 │ convertResponseToSSEEvents()      │
     │                 │───────────────►│                  │
     │                 │  SSEEvent[] (id=block.id)         │
     │                 │◄───────────────│                  │
     │                 │ history.addAssistantMessage()     │
     │                 │ (stores same id)                  │
     │  SSE stream     │                                  │
     │◄────────────────│                                  │
     │ (id=tooluse_XYZ)│                                  │
     │                 │                                  │
     │ POST /chat/completions (continuation)              │
     │ toolResult.toolUseId=tooluse_XYZ                   │
     │────────────────►│                                  │
     │                 │ history.findToolUse("tooluse_XYZ")│
     │                 │ → FOUND ✓                        │
     │                 │ forwardToKiroQ() (with result)    │
     │                 │─────────────────────────────────►│
     │                 │                                  │
```

---

## 7. Security Design

### 7.1 No Changes Required

The fix is purely internal to the conversion logic. No authentication, authorization, or data sensitivity changes are needed.

- **tool_use_id**: Internal correlation identifier — no PII
- **Tool input/output**: Already sandboxed within user workspace
- **Conversation history**: Ephemeral in-memory, cleared on session end

### 7.2 Input Validation (BR-3)

```typescript
// Validate tool_use_id format before accepting
if (!validateToolUseId(block.id)) {
  // Reject malformed IDs from API — prevent injection
  return errorResponse(502, 'malformed_api_response');
}
```

Pattern: `/^tooluse_[A-Za-z0-9]+$/` — strict alphanumeric after prefix.

---

## 8. Performance & Scalability

### 8.1 Performance Impact

| Metric | Before Fix | After Fix | Delta |
|--------|-----------|-----------|-------|
| ID lookup (continuation) | O(n) scan or miss | O(1) Map lookup | Faster |
| SSE event generation | generateId() call | Direct assignment | ~0.01ms saved |
| Memory | Map + orphan entries | Map (no orphans) | Less waste |

### 8.2 No New Overhead

- ID passthrough is a direct string assignment — zero computational cost
- `Map<string, ToolUseContentBlock>` gives O(1) lookup for continuation matching
- No additional network calls, no caching layers needed

### 8.3 Concurrency (BR-5)

Node.js is single-threaded (event loop). Multiple tool_use blocks in one response are processed sequentially within a single `forEach` iteration — no race conditions possible. No mutex/lock needed.

---

## 9. Monitoring & Observability

### 9.1 Logging Strategy

| Point | Level | Fields | Purpose |
|-------|-------|--------|---------|
| API response received | TRACE | `tool_use_ids[]`, `stop_reason` | Verify IDs arrive correctly |
| SSE event emitted | TRACE | `tool_use_id`, `tool_name`, `block_index` | Verify passthrough in stream |
| History stored | TRACE | `tool_use_ids[]`, `turn_number` | Verify history matches stream |
| Continuation matched | DEBUG | `tool_use_id`, `turn_number` | Confirm successful match |
| **Mismatch detected** | **WARN** | `received_id`, `available_ids[]`, `turn_number` | **Diagnostic for UC-2 (BR-7)** |
| Invalid ID from API | ERROR | `raw_id`, `response_id` | Malformed upstream response |

### 9.2 Structured Logging Format

```typescript
// Using pino or winston with JSON output
logger.warn('tool_use_id mismatch', {
  event: 'TOOL_USE_ID_MISMATCH',
  receivedId: 'tooluse_WRONG',
  availableIds: ['tooluse_ABC', 'tooluse_DEF'],
  turnNumber: 3,
  timestamp: new Date().toISOString(),
});
```

### 9.3 Health Check

```
GET /health → { "status": "ok", "uptime": 12345 }
```

No changes to health check for this fix.

---

## 10. Implementation Checklist

### 10.1 Tasks (14 items — TypeScript equivalent)

| # | Task | File | Implements | Priority |
|---|------|------|-----------|----------|
| 1 | Define TypeScript interfaces for Kiro Q and Anthropic types | `src/anthropic/types.ts` | BR-1, BR-3 | High |
| 2 | Remove ID generation logic from converter | `src/anthropic/converter.ts` | BR-1 | High |
| 3 | Implement direct `block.id` passthrough in `convertResponseToSSEEvents()` | `src/anthropic/converter.ts` | BR-1, BR-2 | High |
| 4 | Add `validateToolUseId()` function | `src/anthropic/converter.ts` | BR-3 | High |
| 5 | Add `extractToolUseIds()` helper | `src/anthropic/converter.ts` | BR-2 | Medium |
| 6 | Implement `ConversationHistory` class with Map-based index | `src/history/conversation.ts` | BR-2, BR-4 | High |
| 7 | Add mismatch detection in handler (UC-2) | `src/anthropic/handlers.ts` | BR-6, BR-7, BR-8 | High |
| 8 | Add descriptive error response format | `src/anthropic/handlers.ts` | BR-8 | High |
| 9 | Add trace logging at all transformation points | `src/anthropic/converter.ts`, `handlers.ts` | NFR Observability | Medium |
| 10 | Write unit tests for converter passthrough | `src/anthropic/__tests__/converter.test.ts` | TC-1, TC-2, TC-10 | High |
| 11 | Write unit tests for multi-tool-use handling | `src/anthropic/__tests__/converter.test.ts` | TC-5, TC-9 | High |
| 12 | Write integration tests for full ReAct loop | `src/anthropic/__tests__/handlers.test.ts` | TC-3, TC-4 | High |
| 13 | Write tests for mismatch diagnostics | `src/anthropic/__tests__/handlers.test.ts` | TC-6, TC-7, TC-8 | Medium |
| 14 | Remove/delete any `generateToolUseId()` or similar utility | `src/utils/` or `converter.ts` | TC-10, BR-1 | High |

### 10.2 Change Summary

| File | Change Type | Lines Changed (est.) |
|------|-------------|---------------------|
| `src/anthropic/converter.ts` | Modify | ~15 lines (replace ID generation with passthrough) |
| `src/anthropic/handlers.ts` | Modify | ~30 lines (add mismatch detection + error response) |
| `src/anthropic/types.ts` | Add/Modify | ~80 lines (ensure correct type definitions) |
| `src/history/conversation.ts` | Add/Modify | ~60 lines (add findToolUse + getAllToolUseIds) |
| `src/anthropic/__tests__/converter.test.ts` | Add | ~100 lines |
| `src/anthropic/__tests__/handlers.test.ts` | Add | ~120 lines |
| **Total** | | **~405 lines** |

---

## 11. Error Handling Strategy

### 11.1 Exception Hierarchy

```typescript
// Custom error classes for typed error handling
export class ToolUseIdMismatchError extends Error {
  constructor(
    public receivedId: string,
    public availableIds: string[],
    public turnNumber: number,
  ) {
    super(`tool_use_id '${receivedId}' not found in history`);
    this.name = 'ToolUseIdMismatchError';
  }
}

export class MalformedApiResponseError extends Error {
  constructor(public reason: string) {
    super(`Malformed API response: ${reason}`);
    this.name = 'MalformedApiResponseError';
  }
}
```

### 11.2 Error Handling Matrix

| Error | HTTP Status | User Message | Log Level |
|-------|------------|-------------|-----------|
| tool_use_id mismatch | 400 | "Tool continuation failed: tool_use_id '{id}' not found..." | WARN |
| Missing/empty tool_use_id from API | 502 | "Received malformed tool_use response from API" | ERROR |
| Invalid tool_use_id format | 502 | "Invalid tool_use_id format from API" | ERROR |
| Network error to Kiro Q | 502 | "AI service unavailable, please retry" | ERROR |
| Timeout to Kiro Q | 504 | "AI service did not respond in time" | WARN |

---

## 12. Testing Strategy

### 12.1 Unit Tests — Converter (`converter.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { convertResponseToSSEEvents, validateToolUseId, extractToolUseIds } from '../converter';

describe('convertResponseToSSEEvents', () => {
  it('TC-1: preserves tool_use_id in SSE stream', () => {
    const response = {
      id: 'msg_123',
      type: 'message' as const,
      role: 'assistant' as const,
      content: [{
        type: 'tool_use' as const,
        id: 'tooluse_490CAbc',
        name: 'readFile',
        input: { path: '/src/main.ts' },
      }],
      stop_reason: 'tool_use' as const,
    };

    const events = convertResponseToSSEEvents(response);
    const startEvent = events.find(e => e.type === 'content_block_start');

    expect(startEvent).toBeDefined();
    expect((startEvent as any).content_block.id).toBe('tooluse_490CAbc');
  });

  it('TC-5: preserves multiple tool_use_ids independently', () => {
    const response = {
      id: 'msg_456',
      type: 'message' as const,
      role: 'assistant' as const,
      content: [
        { type: 'tool_use' as const, id: 'tooluse_AAA', name: 'readFile', input: {} },
        { type: 'tool_use' as const, id: 'tooluse_BBB', name: 'grep', input: {} },
        { type: 'tool_use' as const, id: 'tooluse_CCC', name: 'writeFile', input: {} },
      ],
      stop_reason: 'tool_use' as const,
    };

    const events = convertResponseToSSEEvents(response);
    const startEvents = events.filter(e => e.type === 'content_block_start');

    expect(startEvents).toHaveLength(3);
    expect((startEvents[0] as any).content_block.id).toBe('tooluse_AAA');
    expect((startEvents[1] as any).content_block.id).toBe('tooluse_BBB');
    expect((startEvents[2] as any).content_block.id).toBe('tooluse_CCC');
  });

  it('TC-10: no call to ID generation — regression guard', () => {
    // Verify the output id exactly matches input id
    const inputId = 'tooluse_ExactMatch123';
    const response = {
      id: 'msg_789',
      type: 'message' as const,
      role: 'assistant' as const,
      content: [{ type: 'tool_use' as const, id: inputId, name: 'test', input: {} }],
      stop_reason: 'tool_use' as const,
    };

    const events = convertResponseToSSEEvents(response);
    const ids = extractToolUseIds(response);

    // Both extraction methods return the exact same input ID
    expect(ids).toEqual([inputId]);
    const startEvent = events.find(e => e.type === 'content_block_start') as any;
    expect(startEvent.content_block.id).toBe(inputId);
  });
});

describe('validateToolUseId', () => {
  it('TC-7: rejects empty string', () => {
    expect(validateToolUseId('')).toBe(false);
  });

  it('TC-8: rejects missing/undefined', () => {
    expect(validateToolUseId(undefined)).toBe(false);
    expect(validateToolUseId(null)).toBe(false);
  });

  it('accepts valid format', () => {
    expect(validateToolUseId('tooluse_ABC123xyz')).toBe(true);
  });

  it('rejects invalid prefix', () => {
    expect(validateToolUseId('tool_ABC123')).toBe(false);
    expect(validateToolUseId('ABC123')).toBe(false);
  });
});
```

### 12.2 Integration Tests — Handler (`handlers.test.ts`)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server'; // Express app

describe('POST /chat/completions', () => {
  it('TC-4: full ReAct loop completes without 400', async () => {
    // Step 1: Initial request triggers tool_use
    const res1 = await request(app)
      .post('/chat/completions')
      .send({ messages: [{ role: 'user', content: 'read file' }] });

    expect(res1.status).toBe(200);
    // Parse SSE to extract tool_use_id
    const toolUseId = extractIdFromSSE(res1.text);
    expect(toolUseId).toMatch(/^tooluse_[A-Za-z0-9]+$/);

    // Step 2: Continuation with matching ID
    const res2 = await request(app)
      .post('/chat/completions')
      .send({
        messages: [...],
        toolResult: { toolUseId, content: 'file contents' },
      });

    expect(res2.status).toBe(200); // NOT 400
  });

  it('TC-6: returns diagnostic error on mismatch', async () => {
    // First, store a valid tool_use
    await request(app).post('/chat/completions').send({...});

    // Then send wrong ID
    const res = await request(app)
      .post('/chat/completions')
      .send({
        toolResult: { toolUseId: 'tooluse_NONEXISTENT', content: 'result' },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe('tool_use_id_mismatch');
    expect(res.body.error.received_id).toBe('tooluse_NONEXISTENT');
    expect(res.body.error.available_ids).toBeInstanceOf(Array);
  });
});
```

### 12.3 Test Coverage Targets

| Level | Target | Focus |
|-------|--------|-------|
| Unit (converter) | 100% | All branches: tool_use, text, empty, invalid |
| Unit (history) | 100% | add, find, getAllIds, clear |
| Integration (handler) | 90% | Full flow, mismatch, validation |
| E2E (manual) | — | VS Code extension → kiro-ts → Kiro Q API |

---

## 13. Deployment

### 13.1 Build & Package

```bash
npm run build        # tsc → dist/
npm run test         # vitest run
npm run lint         # eslint
```

### 13.2 Environment Configuration

| Variable | Purpose | Default |
|----------|---------|---------|
| `KIRO_Q_API_URL` | Backend API endpoint | `https://api.kiro.dev` |
| `KIRO_Q_API_TOKEN` | Service auth token | — (required) |
| `PORT` | HTTP server port | `3000` |
| `LOG_LEVEL` | Logging verbosity | `info` |
| `NODE_ENV` | Environment | `production` |

### 13.3 Rollback Strategy

Since this is a bug fix with no schema changes:
1. Revert to previous container image / npm package version
2. No data migration needed (in-memory only)
3. Rollback is instant and safe

### 13.4 Feature Flags

Not needed — this is a critical bug fix, not a new feature. Deploy directly.

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Diagram | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

### Traceability Matrix (FSD → TDD)

| FSD Requirement | TDD Section | Implementation |
|----------------|-------------|----------------|
| UC-1 (ReAct Tool Loop) | §3, §5.3, §5.4 | converter.ts + handlers.ts |
| UC-2 (Diagnostic Error) | §3.1, §5.4, §11 | handlers.ts mismatch detection |
| BR-1 (ID passthrough) | §5.3, §5.6 | `id: block.id` in converter |
| BR-2 (Same ID in 3 locations) | §5.3, §5.4, §5.5 | converter + handler + history |
| BR-3 (ID format validation) | §5.3 | `validateToolUseId()` |
| BR-4 (No ID reuse) | §5.5 | Map-based indexing |
| BR-5 (Multiple blocks) | §5.3 | `forEach` iteration |
| BR-6 (Log on mismatch) | §5.4, §9 | WARN log in handler |
| BR-7 (Diagnostic fields) | §5.4, §9 | received_id + available_ids + turn |
| BR-8 (Descriptive error) | §3.1, §5.4 | JSON error response |
| BR-9 (WARN not ERROR) | §9.1 | `logger.warn()` |

