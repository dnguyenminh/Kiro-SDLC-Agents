# TODO: Fix LangGraph Agent Tool-Calling Loop

## Problem

Chat agent (SDLC Pipeline) không chain multiple tool calls. Khi user hỏi "review source code":
1. Agent gọi `list_directory` ✅
2. Nhận kết quả → nhưng KHÔNG gọi `read_file` tiếp → trả text hỏi user ❌
3. `verify_response` node detect "INCOMPLETE" → nhưng graph KHÔNG loop lại ❌

## Root Cause

`graph.invoke()` trong LangGraph JS chạy single-pass. Mặc dù có conditional edges tạo cycle (`verify_response → agent_step`), graph execution kết thúc sau khi verify node trả state update.

Possible causes:
- LangGraph `StateGraph` compile() không tạo cycle đúng cách
- `agentOutputs: []` (clear) trong verify node không trigger re-execution
- `invoke()` cần `recursionLimit` config để cho phép cycles

## Evidence from Logs

```
[LLM-RES] type=tool_use, calls=list_directory({"path":"."})
[graph] routeAgentStep: 1 toolCalls -> execute_tools
[LLM-REQ] iteration=1, messages=5, tools=69
[LLM-RES] type=text, length=590  ← MODEL RESPONDS TEXT INSTEAD OF TOOL
[graph] routeAgentStep: text response -> verify_response
[VERIFY-RES] raw="INCOMPLETE: Agent must use tools instead of asking user"
handleUserMessage: invokeChat RETURNED  ← GRAPH ENDED, NO RETRY
```

## Tasks

1. Fix LangGraph Cycle Execution (verify → agent_step loop)
2. Fix Scratchpad Accumulation Between Iterations
3. Improve Model Prompting for Tool Chain (limit to 10 tools)
4. Fix list_directory to show relevant source folders

## Files

- `src/langgraph/graphs/chat-graph.ts`
- `src/langgraph/graphs/chat-graph-nodes.ts`
- `src/langgraph/graphs/verify-node.ts`
- `src/langgraph/vscode-tools.ts`
- `src/langgraph/engine-chat-handler.ts`

## Priority: HIGH
## Created: 2026-07-01
