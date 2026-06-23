"use strict";
/**
 * Chat Subgraph — ReAct Agent Loop with Full MCP Tool Calling
 * The chat panel acts as a full AI agent that can call ANY MCP tool.
 *
 * Flow:
 *   __start__ -> fetch_tools -> agent_step -> [route]
 *     - If tool_use -> execute_tools -> [route]
 *       - If iterations < 10 -> agent_step (loop)
 *       - If iterations >= 10 -> __end__
 *     - If text -> __end__
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildChatSubgraph = buildChatSubgraph;
const langgraph_1 = require("@langchain/langgraph");
const state_1 = require("../state");
const tool_registry_1 = require("../tool-registry");
const vscode_tools_1 = require("../vscode-tools");
const steering_loader_1 = require("../steering-loader");
const debug_logger_1 = require("../../debug-logger");
/** Maximum ReAct iterations — generous cap; on hit we force a final answer */
const MAX_AGENT_ITERATIONS = 25;
/** LLM call timeout (3 minutes) — prevents hanging on API issues */
const LLM_CALL_TIMEOUT_MS = 180_000;
const AGENT_SYSTEM_PROMPT = `You are a conversational AI assistant. You help users understand their project by answering questions.

## YOUR ROLE:
- You ANSWER QUESTIONS about the project, tickets, code, and documents
- You ANALYZE data when asked
- You SEARCH for information using your tools
- You SUMMARIZE and EXPLAIN things clearly

## YOU MUST NEVER:
- Create BRD, FSD, TDD, STP, or any SDLC documents
- Generate long specification documents
- Output structured document templates
- Pretend to be a Business Analyst, Solution Architect, or any SDLC role

## HOW TO RESPOND:
- Keep responses SHORT (3-10 sentences for simple questions, max 20 for complex analysis)
- Use bullet points for clarity
- When analyzing a ticket: summarize the scope, status, key requirements, and suggest next steps
- Respond in the same language the user writes in

## TOOL USAGE:
- Use tools to look up real data before answering
- After getting tool results, SYNTHESIZE them into a concise answer
- NEVER dump raw tool output to the user`;
/**
 * Build messages array from chat history and accumulated tool results.
 * Dynamically loads steering rules and injects into system prompt (KSA-242).
 */
function buildMessages(state, tools, systemPrompt) {
    const messages = [
        { role: "system", content: systemPrompt },
    ];
    // Add chat history (user + assistant final answers from previous turns)
    const history = state.chatHistory || [];
    for (const msg of history) {
        if (msg.role === "user" || msg.role === "assistant") {
            messages.push({ role: msg.role, content: msg.content });
        }
    }
    // KSA-240: Append the ReAct scratchpad — correctly-paired assistant(tool_use)
    // and tool(result) messages accumulated across iterations. This ensures the
    // LLM sees each tool_use matched with its tool_result, so it can synthesize
    // a final answer instead of looping forever.
    const scratchpad = state.agentScratchpad || [];
    for (const m of scratchpad) {
        messages.push(m);
    }
    return messages;
}
/**
 * Route after agent_step: if tool calls present go to execute_tools, else end.
 */
function routeAgentStep(state) {
    if (state.toolCalls && state.toolCalls.length > 0) {
        (0, debug_logger_1.debugLog)(`[graph] routeAgentStep: ${state.toolCalls.length} toolCalls -> execute_tools`);
        return "execute_tools";
    }
    (0, debug_logger_1.debugLog)(`[graph] routeAgentStep: no toolCalls -> __end__`);
    return "__end__";
}
/**
 * Route after tool execution: loop back if under max iterations, else end.
 */
function routeAfterToolExec(state) {
    if ((state.agentIterations || 0) >= MAX_AGENT_ITERATIONS) {
        (0, debug_logger_1.debugLog)(`[graph] routeAfterToolExec: iterations=${state.agentIterations} >= MAX(${MAX_AGENT_ITERATIONS}) -> synthesize (force final answer)`);
        return "synthesize";
    }
    (0, debug_logger_1.debugLog)(`[graph] routeAfterToolExec: iterations=${state.agentIterations} -> agent_step (loop)`);
    return "agent_step";
}
/**
 * Build the chat subgraph — ReAct agent loop with MCP tool calling.
 * Falls back to simple streaming chat if LLM doesn't support tool calling.
 */
async function buildChatSubgraph(streamHandler, llmProvider, mcpBridge, workspaceRoot, hookEngine) {
    const toolRegistry = mcpBridge ? new tool_registry_1.ToolRegistry(mcpBridge) : null;
    const wsRoot = workspaceRoot || require("vscode").workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    // KSA-242: Load steering rules once at graph build time for chat system prompt
    let enrichedSystemPrompt = AGENT_SYSTEM_PROMPT;
    try {
        if (wsRoot) {
            const rules = await (0, steering_loader_1.loadSteeringRules)(wsRoot, "langgraph");
            enrichedSystemPrompt = (0, steering_loader_1.injectSteering)(AGENT_SYSTEM_PROMPT, rules);
            // KSA-280: Emit steering injection as visible action block in chat
            if (rules.length > 0 && streamHandler) {
                const ruleNames = rules.map(r => r.meta.title || r.filePath).join(", ");
                streamHandler.emitDirect({
                    type: "chat:toolCall",
                    toolCall: {
                        id: `steering-${Date.now()}`,
                        name: "steering_rules_loaded",
                        args: { count: rules.length, rules: ruleNames.slice(0, 200) },
                        status: "completed",
                        result: `${rules.length} steering rules injected into context`,
                        duration: 0,
                    },
                });
            }
        }
    }
    catch {
        // Fallback to base prompt if steering load fails
    }
    const graph = new langgraph_1.StateGraph(state_1.PipelineAnnotation)
        // Node 1: Fetch available tools from MCP + VS Code built-in tools
        .addNode("fetch_tools", async (_state) => {
        let mcpTools = [];
        if (toolRegistry) {
            try {
                mcpTools = await toolRegistry.getTools();
            }
            catch {
                mcpTools = [];
            }
        }
        // Merge VS Code tools (always available) + MCP tools
        const allTools = [...vscode_tools_1.VSCODE_TOOL_DEFINITIONS, ...mcpTools];
        (0, debug_logger_1.debugLog)(`[graph] fetch_tools: ${mcpTools.length} MCP tools + ${vscode_tools_1.VSCODE_TOOL_DEFINITIONS.length} VSCode tools = ${allTools.length} total`);
        return {
            parallelResults: { toolsJson: JSON.stringify(allTools) },
            lastUpdatedAt: new Date().toISOString(),
        };
    })
        // Node 2: Agent reasoning step — call LLM with tools
        .addNode("agent_step", async (state) => {
        if (!llmProvider) {
            return {
                agentOutputs: [{
                        nodeId: "chat",
                        content: "No LLM configured. Open Settings (gear icon) to set up Anthropic, OpenAI, or Ollama.",
                        timestamp: new Date().toISOString(),
                    }],
                pipelineStatus: "completed",
                toolCalls: null,
                lastUpdatedAt: new Date().toISOString(),
            };
        }
        const streamId = state.currentStreamId || `stream-chat-${Date.now()}`;
        let tools = [];
        try {
            const parsed = JSON.parse(state.parallelResults?.toolsJson || "[]");
            tools = Array.isArray(parsed) ? parsed : [];
        }
        catch {
            tools = [];
        }
        // If provider supports tool calling AND tools are available, use ReAct
        (0, debug_logger_1.debugLog)(`[graph] agent_step: iteration=${state.agentIterations || 0}, hasChatWithTools=${!!llmProvider.chatWithTools}, toolCount=${tools.length}`);
        if (llmProvider.chatWithTools && tools.length > 0) {
            try {
                const messages = buildMessages(state, tools, enrichedSystemPrompt);
                // Limit tools to max 15 to reduce token overhead in request
                const limitedTools = tools.slice(0, 15);
                // Wrap LLM call with timeout to prevent infinite hang
                const llmPromise = llmProvider.chatWithTools(messages, limitedTools, { maxTokens: 8192 });
                const timeoutPromise = new Promise((_, reject) => {
                    const timer = setTimeout(() => reject(new Error("LLM call timed out after 3 minutes")), LLM_CALL_TIMEOUT_MS);
                    if (timer.unref)
                        timer.unref();
                });
                const response = await Promise.race([llmPromise, timeoutPromise]);
                (0, debug_logger_1.debugLog)(`[graph] agent_step: LLM response type="${response.type}", textLen=${response.text?.length || 0}, toolCalls=${response.toolCalls?.length || 0}`);
                if (response.type === "text") {
                    // LLM responded with final text — stream to UI
                    streamHandler.emitStatus("chat", "active", streamId);
                    streamHandler.emitToken("chat", response.text || "", streamId);
                    streamHandler.emitComplete("chat", 0, streamId);
                    streamHandler.emitDirect({ type: "chat:workingStatus", working: false });
                    return {
                        agentOutputs: [{
                                nodeId: "chat",
                                content: response.text || "",
                                timestamp: new Date().toISOString(),
                            }],
                        pipelineStatus: "completed",
                        toolCalls: null,
                        lastUpdatedAt: new Date().toISOString(),
                    };
                }
                else {
                    // LLM wants to call tools — save structured tool calls for buildMessages
                    const toolCallsForHistory = JSON.stringify((response.toolCalls || []).map(tc => ({
                        type: "tool_use",
                        id: tc.id,
                        name: tc.name,
                        input: tc.arguments,
                    })));
                    return {
                        toolCalls: response.toolCalls || null,
                        parallelResults: { lastToolCallsJson: toolCallsForHistory },
                        lastUpdatedAt: new Date().toISOString(),
                    };
                }
            }
            catch (error) {
                streamHandler.emitError("chat", error.message, streamId);
                return {
                    errors: [{
                            nodeId: "chat",
                            code: "LLM_ERROR",
                            message: error.message,
                            timestamp: new Date().toISOString(),
                            recoverable: true,
                        }],
                    pipelineStatus: "failed",
                    toolCalls: null,
                    lastUpdatedAt: new Date().toISOString(),
                };
            }
        }
        // Fallback: simple streaming chat (no tool calling)
        streamHandler.emitStatus("chat", "active", streamId);
        try {
            const messages = buildMessages(state, tools, enrichedSystemPrompt);
            const stream = llmProvider.chatStream(messages, { maxTokens: 8192 });
            let fullResponse = "";
            for await (const token of stream) {
                fullResponse += token;
                streamHandler.emitToken("chat", token, streamId);
            }
            streamHandler.emitComplete("chat", 0, streamId);
            streamHandler.emitDirect({ type: "chat:workingStatus", working: false });
            return {
                agentOutputs: [{
                        nodeId: "chat",
                        content: fullResponse,
                        timestamp: new Date().toISOString(),
                    }],
                pipelineStatus: "completed",
                toolCalls: null,
                lastUpdatedAt: new Date().toISOString(),
            };
        }
        catch (error) {
            streamHandler.emitError("chat", error.message, streamId);
            return {
                errors: [{
                        nodeId: "chat",
                        code: "LLM_ERROR",
                        message: error.message,
                        timestamp: new Date().toISOString(),
                        recoverable: true,
                    }],
                pipelineStatus: "failed",
                toolCalls: null,
                lastUpdatedAt: new Date().toISOString(),
            };
        }
    })
        // Node 3: Execute tool calls via MCP
        .addNode("execute_tools", async (state) => {
        const streamId = state.currentStreamId || `stream-chat-${Date.now()}`;
        const calls = state.toolCalls || [];
        const results = [];
        (0, debug_logger_1.debugLog)(`[graph] execute_tools: executing ${calls.length} tool calls: [${calls.map(c => c.name).join(", ")}]`);
        // KSA-247: Complete any open stream BEFORE emitting tool call blocks
        // This ensures tool blocks render AFTER any prior streaming text and aren't wiped
        streamHandler.emitComplete("chat", 0, streamId);
        for (const call of calls) {
            const tcId = call.id || `tc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const argsStr = JSON.stringify(call.arguments || {});
            (0, debug_logger_1.debugLog)(`[graph] execute_tools: TOOL "${call.name}" args=${argsStr.length > 300 ? argsStr.slice(0, 300) + "...(truncated)" : argsStr}`);
            // KSA-280: Fire preToolUse hooks
            if (hookEngine) {
                try {
                    const preResult = await hookEngine.firePreToolUse(call.name, call.arguments || {}, streamHandler, streamId);
                    if (preResult.denied) {
                        (0, debug_logger_1.debugLog)(`[graph] execute_tools: HOOK DENIED "${call.name}" by "${preResult.hookName}": ${preResult.reason}`);
                        results.push({ toolCallId: call.id, name: call.name, content: `Denied by hook "${preResult.hookName}": ${preResult.reason}` });
                        continue;
                    }
                }
                catch (hookErr) {
                    (0, debug_logger_1.debugError)(`[graph] execute_tools: preToolUse hook error for "${call.name}"`, hookErr);
                }
            }
            // KSA-247: Emit structured tool call block (collapsible UI)
            streamHandler.emitDirect({
                type: "chat:toolCall",
                toolCall: { id: tcId, name: call.name, args: call.arguments, status: "running" }
            });
            const startTime = Date.now();
            try {
                let result;
                // KSA-282: Validate required params for write-type tools
                if (call.name === "stream_write_file" && (!call.arguments?.file_path && !call.arguments?.path)) {
                    result = "Error: 'file_path' is required for stream_write_file";
                }
                else if ((0, vscode_tools_1.isVscodeTool)(call.name)) {
                    // Route: VS Code tools execute locally, MCP tools via bridge
                    result = await (0, vscode_tools_1.executeVscodeTool)(call.name, call.arguments, wsRoot);
                }
                else if (mcpBridge) {
                    result = await mcpBridge.callTool(call.name, call.arguments);
                }
                else {
                    result = `Error: Tool '${call.name}' not available (no MCP connection)`;
                }
                const duration = Date.now() - startTime;
                (0, debug_logger_1.debugLog)(`[graph] execute_tools: RESULT "${call.name}" (${duration}ms, ${result.length} chars): ${result.slice(0, 200).replace(/\n/g, " ")}${result.length > 200 ? "..." : ""}`);
                // KSA-247: Emit tool call update with result (truncated for UI display)
                const displayResult = result.length > 500 ? result.slice(0, 500) + "..." : result;
                streamHandler.emitDirect({
                    type: "chat:toolCallUpdate",
                    id: tcId, status: "completed", result: displayResult, duration
                });
                // KSA-280: Fire postToolUse hooks
                if (hookEngine) {
                    try {
                        await hookEngine.firePostToolUse(call.name, call.arguments || {}, result, streamHandler, streamId);
                    }
                    catch (hookErr) {
                        (0, debug_logger_1.debugError)(`[graph] execute_tools: postToolUse hook error for "${call.name}"`, hookErr);
                    }
                }
                results.push({
                    toolCallId: call.id,
                    name: call.name,
                    content: result,
                });
            }
            catch (error) {
                const duration = Date.now() - startTime;
                (0, debug_logger_1.debugError)(`[graph] execute_tools: TOOL "${call.name}" FAILED (${duration}ms)`, error);
                // KSA-247: Emit tool call failure
                streamHandler.emitDirect({
                    type: "chat:toolCallUpdate",
                    id: tcId, status: "failed", result: error.message, duration
                });
                results.push({
                    toolCallId: call.id,
                    name: call.name,
                    content: `Error: ${error.message}`,
                });
            }
        }
        // KSA-240: Build correctly-paired scratchpad messages for this iteration.
        // assistant(tool_use blocks) followed by tool(result) for each call.
        const assistantToolUse = JSON.stringify(calls.map(c => ({ type: "tool_use", id: c.id, name: c.name, input: c.arguments })));
        const scratchpadMessages = [
            { role: "assistant", content: assistantToolUse },
        ];
        for (const r of results) {
            scratchpadMessages.push({
                role: "tool",
                content: r.content,
                toolCallId: r.toolCallId,
                toolName: r.name,
            });
        }
        (0, debug_logger_1.debugLog)(`[graph] execute_tools: appending ${scratchpadMessages.length} scratchpad messages (1 assistant + ${results.length} results)`);
        return {
            toolResults: results,
            agentScratchpad: scratchpadMessages,
            toolCalls: null, // Clear tool calls after execution
            agentIterations: (state.agentIterations || 0) + 1,
            currentStreamId: `stream-chat-${Date.now()}`, // KSA-247: New streamId so next text streams fresh
            lastUpdatedAt: new Date().toISOString(),
        };
    })
        // Node 4: Synthesize — force a final text answer when iteration cap is hit.
        // Calls the LLM WITHOUT tools so it must produce text instead of more tool calls.
        .addNode("synthesize", async (state) => {
        const streamId = state.currentStreamId || `stream-chat-${Date.now()}`;
        (0, debug_logger_1.debugLog)(`[graph] synthesize: forcing final answer after ${state.agentIterations} iterations`);
        if (!llmProvider) {
            return { pipelineStatus: "completed", lastUpdatedAt: new Date().toISOString() };
        }
        try {
            const messages = buildMessages(state, [], enrichedSystemPrompt);
            messages.push({
                role: "user",
                content: "Based on all the information gathered above, provide your final answer now. Do not call any more tools — synthesize what you found into a clear, concise response.",
            });
            streamHandler.emitStatus("chat", "active", streamId);
            // Use streaming if available, else single call
            let fullResponse = "";
            if (llmProvider.chatStream) {
                const stream = llmProvider.chatStream(messages, { maxTokens: 8192 });
                for await (const token of stream) {
                    fullResponse += token;
                    streamHandler.emitToken("chat", token, streamId);
                }
            }
            else if (llmProvider.chatWithTools) {
                const resp = await llmProvider.chatWithTools(messages, [], { maxTokens: 8192 });
                fullResponse = resp.text || "";
                streamHandler.emitToken("chat", fullResponse, streamId);
            }
            streamHandler.emitComplete("chat", 0, streamId);
            streamHandler.emitDirect({ type: "chat:workingStatus", working: false });
            (0, debug_logger_1.debugLog)(`[graph] synthesize: produced ${fullResponse.length} chars`);
            return {
                agentOutputs: [{ nodeId: "chat", content: fullResponse, timestamp: new Date().toISOString() }],
                pipelineStatus: "completed",
                lastUpdatedAt: new Date().toISOString(),
            };
        }
        catch (error) {
            streamHandler.emitError("chat", error.message, streamId);
            streamHandler.emitDirect({ type: "chat:workingStatus", working: false });
            return { pipelineStatus: "failed", lastUpdatedAt: new Date().toISOString() };
        }
    })
        // Edges
        .addEdge("__start__", "fetch_tools")
        .addEdge("fetch_tools", "agent_step")
        .addConditionalEdges("agent_step", routeAgentStep, {
        execute_tools: "execute_tools",
        __end__: langgraph_1.END,
    })
        .addConditionalEdges("execute_tools", routeAfterToolExec, {
        agent_step: "agent_step",
        synthesize: "synthesize",
    })
        .addEdge("synthesize", langgraph_1.END);
    return graph.compile();
}
//# sourceMappingURL=chat-graph.js.map