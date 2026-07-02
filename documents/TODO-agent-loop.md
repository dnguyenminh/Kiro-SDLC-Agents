# TODO: Fix LangGraph Agent Tool-Calling Loop

## Problem

Chat agent (SDLC Pipeline) không chain multiple tool calls. Khi user hỏi "review source code":
1. Agent gọi `list_directory` ✅
2. Nhận kết quả → nhưng KHÔNG gọi `read_file` tiếp → trả text hỏi user ❌
3. `verify_response` node detect "INCOMPLETE" → nhưng graph KHÔNG loop lại ❌

## Root Cause (IDENTIFIED & FIXED)

**State reducer bug:** `agentOutputs` và `agentScratchpad` dùng append reducer `(e, u) => [...e, ...u]`. Khi verify-node trả `agentOutputs: []` (muốn clear) → append empty = KHÔNG clear → `routeAfterVerify` thấy outputs vẫn còn → route `__end__`.

**Fix applied:**
- `agentOutputs` reducer → replace: `(_e, u) => u` (clear works)
- `agentScratchpad` reducer → replace: `(_e, u) => u` (verify feedback replaces)
- `execute_tools` node → manually accumulates scratchpad before returning
- `verify_response` node → manually accumulates feedback into existing scratchpad

## Tasks

1. ✅ Fix LangGraph Cycle Execution (verify → agent_step loop)
   - Changed agentOutputs reducer from append to replace
   - Changed agentScratchpad reducer from append to replace  
   - Now verify returning `agentOutputs: []` actually clears → routes to `agent_step`

2. ✅ Fix Scratchpad Accumulation Between Iterations
   - execute_tools spreads existing scratchpad: `[...state.agentScratchpad, ...newEntries]`
   - verify_response appends feedback: `[...state.agentScratchpad, feedbackMsg]`

3. ✅ Improve Model Prompting for Tool Chain (limit to 10 tools)
   - Reduced tool limit from 15 to 10 in agent_step
   - Fewer tools = less confusion for model

4. ✅ Fix list_directory to show relevant source folders
   - Added SOURCE_DIRS auto-expand (src, lib, app, backend, frontend, packages, services)
   - Added depth parameter support
   - Expanded EXCLUDE set for IDE/config folders

## Files Modified

- `src/langgraph/state.ts` — reducer changes
- `src/langgraph/graphs/chat-graph-nodes.ts` — scratchpad accumulation + tool limit
- `src/langgraph/graphs/verify-node.ts` — scratchpad accumulation on retry
- `src/langgraph/vscode-tools.ts` — improved list_directory

## Status: ✅ COMPLETED
## Created: 2026-07-01
