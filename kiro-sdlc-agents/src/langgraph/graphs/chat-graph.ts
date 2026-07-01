/**
 * Chat Subgraph — ReAct Agent Loop with Full MCP Tool Calling
 * Flow: __start__ -> fetch_tools -> agent_step -> [route]
 *   - tool_use -> execute_tools -> [route] -> agent_step (loop) or synthesize
 *   - text -> verify_response -> [COMPLETE] -> __end__
 *                              -> [INCOMPLETE] -> agent_step (retry)
 *                              -> [TOOL_NEEDED] -> execute_tools
 */

import { StateGraph, END } from "@langchain/langgraph";
import { PipelineAnnotation, PipelineState } from "../state";
import { StreamHandler } from "../stream-handler";
import { McpBridge } from "../mcp-bridge";
import { ToolRegistry } from "../tool-registry";
import type { LlmProvider } from "../llm-provider";
import { loadSteeringRules, injectSteering } from "../steering-loader";
import { HookEngine } from "../hook-engine";
import { debugLog } from "../../debug-logger";
import {
  createFetchToolsNode, createAgentStepNode,
  createExecuteToolsNode, createSynthesizeNode,
} from "./chat-graph-nodes";
import { createVerifyResponseNode, routeAfterVerify } from "./verify-node";

const MAX_AGENT_ITERATIONS = 25;

const AGENT_SYSTEM_PROMPT = `You are a coding assistant with access to workspace tools. You can read files, search code, and list directories.

## CRITICAL RULES:
1. ALWAYS use tools FIRST before answering questions about code or the project
2. NEVER say "please provide a file path" — use list_directory and read_file yourself
3. When user asks about code: call list_directory to find files, then read_file to read them
4. When user asks to review code: read the code first, THEN give your review

## AVAILABLE TOOLS:
- list_directory: List files in a directory (use path="." for project root)
- read_file: Read file content by path
- grep_search: Search for text patterns across files
- get_diagnostics: Check for errors in files

## WORKFLOW:
1. User asks question → YOU call tools to gather info
2. Tools return results → YOU synthesize and respond
3. NEVER ask user for information you can look up yourself

## RESPONSE STYLE:
- Keep responses concise (5-15 sentences)
- Use bullet points
- Respond in same language as user
- After reading code: give specific feedback with line references`;

function routeAgentStep(state: PipelineState): string {
  if (state.toolCalls && state.toolCalls.length > 0) {
    debugLog(`[graph] routeAgentStep: ${state.toolCalls.length} toolCalls -> execute_tools`);
    return "execute_tools";
  }
  debugLog(`[graph] routeAgentStep: text response -> verify_response`);
  return "verify_response";
}

function routeAfterToolExec(state: PipelineState): string {
  if ((state.agentIterations || 0) >= MAX_AGENT_ITERATIONS) return "synthesize";
  return "agent_step";
}

export async function buildChatSubgraph(
  streamHandler: StreamHandler,
  llmProvider?: LlmProvider,
  mcpBridge?: McpBridge,
  workspaceRoot?: string,
  hookEngine?: HookEngine
) {
  const toolRegistry = mcpBridge ? new ToolRegistry(mcpBridge) : null;
  const wsRoot = workspaceRoot || require("vscode").workspace.workspaceFolders?.[0]?.uri.fsPath || "";

  let enrichedSystemPrompt = AGENT_SYSTEM_PROMPT;
  try {
    if (wsRoot) {
      const rules = await loadSteeringRules(wsRoot, "langgraph");
      enrichedSystemPrompt = injectSteering(enrichedSystemPrompt, rules);
      if (rules.length > 0 && streamHandler) {
        const ruleNames = rules.map(r => r.meta.title || r.filePath).join(", ");
        streamHandler.emitDirect({
          type: "chat:toolCall",
          toolCall: {
            id: `steering-${Date.now()}`, name: "steering_rules_loaded",
            args: { count: rules.length, rules: ruleNames.slice(0, 200) },
            status: "completed", result: `${rules.length} steering rules injected`, duration: 0,
          },
        } as any);
      }
    }
  } catch { /* fallback to base prompt */ }

  const verifyNode = createVerifyResponseNode(llmProvider, streamHandler);

  const graph = new StateGraph(PipelineAnnotation)
    .addNode("fetch_tools", createFetchToolsNode(toolRegistry))
    .addNode("agent_step", createAgentStepNode(llmProvider, streamHandler, enrichedSystemPrompt))
    .addNode("execute_tools", createExecuteToolsNode(mcpBridge, streamHandler, hookEngine, wsRoot))
    .addNode("verify_response", verifyNode)
    .addNode("synthesize", createSynthesizeNode(llmProvider, streamHandler, enrichedSystemPrompt))
    .addEdge("__start__", "fetch_tools")
    .addEdge("fetch_tools", "agent_step")
    .addConditionalEdges("agent_step", routeAgentStep, { execute_tools: "execute_tools", verify_response: "verify_response" })
    .addConditionalEdges("verify_response", routeAfterVerify, { execute_tools: "execute_tools", agent_step: "agent_step", __end__: END })
    .addConditionalEdges("execute_tools", routeAfterToolExec, { agent_step: "agent_step", synthesize: "synthesize" })
    .addEdge("synthesize", END);

  return graph.compile();
}
