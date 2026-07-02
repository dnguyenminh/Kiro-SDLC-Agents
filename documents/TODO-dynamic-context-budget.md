# TODO: Dynamic Context Budgeting

## Problem

Local LLM (LM Studio) chạy trên RAM có context window giới hạn (4K-32K tokens). Khi agent đọc nhiều files + scratchpad tích lũy, total context vượt quá khả năng → LLM timeout hoặc quality giảm.

## Goal

Tự động detect context window của model đang dùng, rồi optimize lượng content gửi cho LLM dựa trên budget còn lại.

## Design

### Step 1: Lấy Context Window từ Model Registry

- `model-registry.ts` đã có field `contextWindow` trên mỗi model
- `/v1/models` API (LM Studio, Ollama) trả context_length
- Expose `getContextWindow(): number` method trên LlmProvider interface

### Step 2: Token Counting

- Ước lượng: 1 token ≈ 4 chars (English) hoặc 3 chars (code)
- Hoặc dùng `js-tiktoken` (đã có trong dependencies) cho counting chính xác
- Function: `estimateTokens(text: string): number`

### Step 3: Budget-Aware buildMessages

```typescript
function buildMessages(state, tools, sysPrompt, contextBudget: number) {
  const systemTokens = estimateTokens(sysPrompt);
  const toolSchemaTokens = estimateTokens(JSON.stringify(tools));
  const reserveForOutput = 2000; // tokens for LLM response
  
  let budget = contextBudget - systemTokens - toolSchemaTokens - reserveForOutput;
  
  // 1. Always include chat history (newest first if over budget)
  // 2. Include scratchpad — prune oldest entries if over budget
  // 3. Truncate tool results if single result exceeds remaining budget
}
```

### Step 4: Dynamic Tool Result Sizing

```typescript
const remainingBudget = contextBudget - currentUsage;
const maxResultChars = Math.max(2000, remainingBudget * 3); // tokens → chars

// list_directory: limit entries based on budget
// read_file: limit line range or truncate tail
```

### Step 5: Scratchpad Pruning

Khi scratchpad vượt budget:
1. Keep newest 2 tool call/result pairs
2. Summarize older entries: "Previously: listed src/ (15 files), read index.ts (200 lines)"
3. Drop oldest entries

## Implementation Steps

- [x] Add `getContextWindow()` to LlmProvider interface
- [x] Implement for each provider (LM Studio, Ollama, OpenAI, Anthropic)
- [x] Add `estimateTokens()` utility function
- [x] Modify `buildMessages()` to accept and respect budget
- [x] Add scratchpad pruning logic
- [x] Dynamic `limit` for list_directory based on remaining budget
- [x] Dynamic `end_line` for read_file based on remaining budget
- [ ] Test with 4K, 8K, 32K context models
- [ ] Add context usage indicator to webview (show % used)

## Files to Modify

- `src/langgraph/llm-provider.ts` — interface addition
- `src/langgraph/providers/*.ts` — implement getContextWindow per provider
- `src/langgraph/graphs/chat-graph-nodes.ts` — buildMessages budget logic
- `src/langgraph/graphs/chat-graph.ts` — pass budget to nodes
- `src/langgraph/state.ts` — add maxContextTokens to state

## Priority: MEDIUM
## Estimated Effort: 4-6 hours
## Created: 2026-07-02
