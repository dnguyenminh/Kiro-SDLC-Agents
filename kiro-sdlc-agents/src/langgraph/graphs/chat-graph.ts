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

import { StateGraph, END } from "@langchain/langgraph";
import { PipelineAnnotation, PipelineState } from "../state";
import { StreamHandler } from "../stream-handler";
import { McpBridge } from "../mcp-bridge";
import { ToolRegistry } from "../tool-registry";
import type { McpToolDefinition } from "../tool-registry";
import type { LlmProvider, LlmMessage, LlmToolCall } from "../llm-provider";
import { VSCODE_TOOL_DEFINITIONS, isVscodeTool, executeVscodeTool } from "../vscode-tools";

/** Maximum ReAct iterations to prevent infinite loops */
const MAX_AGENT_ITERATIONS = 10;

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
 * Reconstructs the full conversation including tool call/result pairs
 * in proper Anthropic Messages format.
 */
function buildMessages(state: PipelineState, tools: McpToolDefinition[]): LlmMessage[] {
  const messages: LlmMessage[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
  ];

  // Add chat history (user messages only — tool interactions handled separately)
  const history = state.chatHistory || [];
  for (const msg of history) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // If we have tool results, we need to include the preceding assistant tool_use
  // message so the Anthropic API can match tool_result to tool_use.
  const toolResults = state.toolResults || [];
  if (toolResults.length > 0) {
    // Reconstruct assistant message with tool_use blocks (stored in parallelResults)
    const lastToolCalls = state.parallelResults?.lastToolCallsJson;
    if (lastToolCalls) {
      // Assistant message indicating tool calls — adapter will format as content array
      messages.push({
        role: "assistant",
        content: lastToolCalls, // JSON string of tool calls for adapter to parse
      });
    }

    // Add tool results as user messages (adapter converts to tool_result blocks)
    for (const result of toolResults) {
      messages.push({
        role: "tool",
        content: result.content,
        toolCallId: result.toolCallId,
        toolName: result.name,
      });
    }
  }

  return messages;
}

/**
 * Route after agent_step: if tool calls present go to execute_tools, else end.
 */
function routeAgentStep(state: PipelineState): string {
  if (state.toolCalls && state.toolCalls.length > 0) {
    return "execute_tools";
  }
  return "__end__";
}

/**
 * Route after tool execution: loop back if under max iterations, else end.
 */
function routeAfterToolExec(state: PipelineState): string {
  if ((state.agentIterations || 0) >= MAX_AGENT_ITERATIONS) {
    return "__end__";
  }
  return "agent_step";
}

/**
 * Build the chat subgraph — ReAct agent loop with MCP tool calling.
 * Falls back to simple streaming chat if LLM doesn't support tool calling.
 */
export async function buildChatSubgraph(
  streamHandler: StreamHandler,
  llmProvider?: LlmProvider,
  mcpBridge?: McpBridge,
  workspaceRoot?: string
) {
  const toolRegistry = mcpBridge ? new ToolRegistry(mcpBridge) : null;
  const wsRoot = workspaceRoot || "";

  const graph = new StateGraph(PipelineAnnotation)
    // Node 1: Fetch available tools from MCP + VS Code built-in tools
    .addNode("fetch_tools", async (_state: PipelineState) => {
      let mcpTools: McpToolDefinition[] = [];
      if (toolRegistry) {
        try {
          mcpTools = await toolRegistry.getTools();
        } catch {
          mcpTools = [];
        }
      }

      // Merge VS Code tools (always available) + MCP tools
      const allTools = [...VSCODE_TOOL_DEFINITIONS, ...mcpTools];

      return {
        parallelResults: { toolsJson: JSON.stringify(allTools) },
        lastUpdatedAt: new Date().toISOString(),
      };
    })

    // Node 2: Agent reasoning step — call LLM with tools
    .addNode("agent_step", async (state: PipelineState) => {
      if (!llmProvider) {
        return {
          agentOutputs: [{
            nodeId: "chat",
            content: "No LLM configured. Open Settings (gear icon) to set up Anthropic, OpenAI, or Ollama.",
            timestamp: new Date().toISOString(),
          }],
          pipelineStatus: "completed" as const,
          toolCalls: null,
          lastUpdatedAt: new Date().toISOString(),
        };
      }

      const streamId = state.currentStreamId || `stream-chat-${Date.now()}`;
      let tools: McpToolDefinition[] = [];
      try {
        const parsed = JSON.parse(state.parallelResults?.toolsJson || "[]");
        tools = Array.isArray(parsed) ? parsed : [];
      } catch {
        tools = [];
      }

      // If provider supports tool calling AND tools are available, use ReAct
      if (llmProvider.chatWithTools && tools.length > 0) {
        try {
          const messages = buildMessages(state, tools);
          // Limit tools to max 15 to reduce token overhead in request
          const limitedTools = tools.slice(0, 15);
          const response = await llmProvider.chatWithTools(messages, limitedTools, { maxTokens: 8192 });

          if (response.type === "text") {
            // LLM responded with final text — stream to UI
            streamHandler.emitStatus("chat", "active", streamId);
            streamHandler.emitToken("chat", response.text || "", streamId);
            streamHandler.emitComplete("chat", 0, streamId);

            return {
              agentOutputs: [{
                nodeId: "chat",
                content: response.text || "",
                timestamp: new Date().toISOString(),
              }],
              pipelineStatus: "completed" as const,
              toolCalls: null,
              lastUpdatedAt: new Date().toISOString(),
            };
          } else {
            // LLM wants to call tools — save structured tool calls for buildMessages
            const toolCallsForHistory = JSON.stringify(
              (response.toolCalls || []).map(tc => ({
                type: "tool_use",
                id: tc.id,
                name: tc.name,
                input: tc.arguments,
              }))
            );

            return {
              toolCalls: response.toolCalls || null,
              parallelResults: { lastToolCallsJson: toolCallsForHistory },
              lastUpdatedAt: new Date().toISOString(),
            };
          }
        } catch (error) {
          streamHandler.emitError("chat", (error as Error).message, streamId);
          return {
            errors: [{
              nodeId: "chat",
              code: "LLM_ERROR",
              message: (error as Error).message,
              timestamp: new Date().toISOString(),
              recoverable: true,
            }],
            pipelineStatus: "failed" as const,
            toolCalls: null,
            lastUpdatedAt: new Date().toISOString(),
          };
        }
      }

      // Fallback: simple streaming chat (no tool calling)
      streamHandler.emitStatus("chat", "active", streamId);
      try {
        const messages = buildMessages(state, tools);
        const stream = llmProvider.chatStream(messages, { maxTokens: 8192 });
        let fullResponse = "";

        for await (const token of stream) {
          fullResponse += token;
          streamHandler.emitToken("chat", token, streamId);
        }

        streamHandler.emitComplete("chat", 0, streamId);

        return {
          agentOutputs: [{
            nodeId: "chat",
            content: fullResponse,
            timestamp: new Date().toISOString(),
          }],
          pipelineStatus: "completed" as const,
          toolCalls: null,
          lastUpdatedAt: new Date().toISOString(),
        };
      } catch (error) {
        streamHandler.emitError("chat", (error as Error).message, streamId);
        return {
          errors: [{
            nodeId: "chat",
            code: "LLM_ERROR",
            message: (error as Error).message,
            timestamp: new Date().toISOString(),
            recoverable: true,
          }],
          pipelineStatus: "failed" as const,
          toolCalls: null,
          lastUpdatedAt: new Date().toISOString(),
        };
      }
    })

    // Node 3: Execute tool calls via MCP
    .addNode("execute_tools", async (state: PipelineState) => {
      const streamId = state.currentStreamId || `stream-chat-${Date.now()}`;
      const calls = state.toolCalls || [];
      const results: Array<{ toolCallId: string; name: string; content: string }> = [];

      for (const call of calls) {
        // Show tool execution indicator in chat
        streamHandler.emitToken("chat", `\n\u{1F527} **${call.name}**(...)\n`, streamId);

        try {
          let result: string;

          // Route: VS Code tools execute locally, MCP tools via bridge
          if (isVscodeTool(call.name)) {
            result = await executeVscodeTool(call.name, call.arguments, wsRoot);
          } else if (mcpBridge) {
            result = await mcpBridge.callTool(call.name, call.arguments);
          } else {
            result = `Error: Tool '${call.name}' not available (no MCP connection)`;
          }

          results.push({
            toolCallId: call.id,
            name: call.name,
            content: result,
          });
        } catch (error) {
          // Tool execution failed — still add result so LLM can handle the error
          results.push({
            toolCallId: call.id,
            name: call.name,
            content: `Error: ${(error as Error).message}`,
          });
          streamHandler.emitToken("chat", `  \u274C Error: ${(error as Error).message}\n`, streamId);
        }
      }

      return {
        toolResults: results,
        toolCalls: null, // Clear tool calls after execution
        agentIterations: (state.agentIterations || 0) + 1,
        lastUpdatedAt: new Date().toISOString(),
      };
    })

    // Edges
    .addEdge("__start__", "fetch_tools")
    .addEdge("fetch_tools", "agent_step")
    .addConditionalEdges("agent_step", routeAgentStep, {
      execute_tools: "execute_tools",
      __end__: END,
    })
    .addConditionalEdges("execute_tools", routeAfterToolExec, {
      agent_step: "agent_step",
      __end__: END,
    });

  return graph.compile();
}
