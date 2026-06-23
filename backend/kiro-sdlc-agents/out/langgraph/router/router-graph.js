"use strict";
/**
 * Router Graph — Multi-Graph Architecture
 * Parent graph that classifies intent and routes to the appropriate subgraph.
 *
 * Flow:
 *   __start__ → classify_intent → [route by intent]:
 *     sdlc → sdlc_subgraph
 *     hotfix → hotfix_subgraph
 *     code_review → code_review_subgraph
 *     docs → docs_subgraph
 *     security_audit → security_audit_subgraph
 *     chat → chat_subgraph
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRouterGraph = buildRouterGraph;
const langgraph_1 = require("@langchain/langgraph");
const state_1 = require("../state");
const intent_classifier_1 = require("./intent-classifier");
/**
 * Build the router graph that classifies intent and delegates to subgraphs.
 */
async function buildRouterGraph(mcpBridge, streamHandler, checkpointer, llmProvider, hookEngine) {
    // Lazy-load subgraph invokers (only imported when needed)
    const subgraphCache = new Map();
    async function getSubgraphInvoker(intent) {
        if (subgraphCache.has(intent)) {
            return subgraphCache.get(intent);
        }
        let invoker;
        switch (intent) {
            case "sdlc": {
                const { buildSdlcSubgraph } = await Promise.resolve().then(() => __importStar(require("../graphs/sdlc-graph")));
                const graph = await buildSdlcSubgraph(mcpBridge, streamHandler, checkpointer, llmProvider);
                invoker = async (state) => {
                    const result = await graph.invoke(state, { configurable: { thread_id: state.threadId } });
                    return result;
                };
                break;
            }
            case "hotfix": {
                const { buildHotfixSubgraph } = await Promise.resolve().then(() => __importStar(require("../graphs/hotfix-graph")));
                const graph = await buildHotfixSubgraph(mcpBridge, streamHandler, llmProvider);
                invoker = async (state) => {
                    const result = await graph.invoke(state);
                    return result;
                };
                break;
            }
            case "code_review": {
                const { buildCodeReviewSubgraph } = await Promise.resolve().then(() => __importStar(require("../graphs/code-review-graph")));
                const graph = await buildCodeReviewSubgraph(mcpBridge, streamHandler, llmProvider);
                invoker = async (state) => {
                    const result = await graph.invoke(state);
                    return result;
                };
                break;
            }
            case "docs": {
                const { buildDocsSubgraph } = await Promise.resolve().then(() => __importStar(require("../graphs/docs-graph")));
                const graph = await buildDocsSubgraph(mcpBridge, streamHandler, llmProvider);
                invoker = async (state) => {
                    const result = await graph.invoke(state);
                    return result;
                };
                break;
            }
            case "security_audit": {
                const { buildSecurityAuditSubgraph } = await Promise.resolve().then(() => __importStar(require("../graphs/security-audit-graph")));
                const graph = await buildSecurityAuditSubgraph(mcpBridge, streamHandler, llmProvider);
                invoker = async (state) => {
                    const result = await graph.invoke(state);
                    return result;
                };
                break;
            }
            case "chat":
            default: {
                const { buildChatSubgraph } = await Promise.resolve().then(() => __importStar(require("../graphs/chat-graph")));
                const wsRoot = require("vscode").workspace.workspaceFolders?.[0]?.uri.fsPath || "";
                const graph = await buildChatSubgraph(streamHandler, llmProvider, mcpBridge, wsRoot, hookEngine);
                invoker = async (state) => {
                    const result = await graph.invoke(state);
                    return result;
                };
                break;
            }
        }
        subgraphCache.set(intent, invoker);
        return invoker;
    }
    // === Build the router graph ===
    const graph = new langgraph_1.StateGraph(state_1.PipelineAnnotation)
        // Node: classify user intent
        .addNode("classify_intent", async (state) => {
        const lastMessage = state.chatHistory?.[state.chatHistory.length - 1];
        const userInput = lastMessage?.content || state.ticketKey || "";
        // If intent is already set (pre-classified by engine), skip classification
        if (state.intent) {
            return { lastUpdatedAt: new Date().toISOString() };
        }
        const classification = await (0, intent_classifier_1.classifyIntent)(userInput, llmProvider);
        return {
            intent: classification.intent,
            lastUpdatedAt: new Date().toISOString(),
        };
    })
        // Node: SDLC subgraph
        .addNode("sdlc_subgraph", async (state) => {
        const invoker = await getSubgraphInvoker("sdlc");
        return invoker(state);
    })
        // Node: Hotfix subgraph
        .addNode("hotfix_subgraph", async (state) => {
        const invoker = await getSubgraphInvoker("hotfix");
        return invoker(state);
    })
        // Node: Code review subgraph
        .addNode("code_review_subgraph", async (state) => {
        const invoker = await getSubgraphInvoker("code_review");
        return invoker(state);
    })
        // Node: Docs subgraph
        .addNode("docs_subgraph", async (state) => {
        const invoker = await getSubgraphInvoker("docs");
        return invoker(state);
    })
        // Node: Security audit subgraph
        .addNode("security_audit_subgraph", async (state) => {
        const invoker = await getSubgraphInvoker("security_audit");
        return invoker(state);
    })
        // Node: Chat subgraph
        .addNode("chat_subgraph", async (state) => {
        const invoker = await getSubgraphInvoker("chat");
        return invoker(state);
    })
        // Entry: start → classify
        .addEdge("__start__", "classify_intent")
        // Conditional routing from classifier to subgraphs
        .addConditionalEdges("classify_intent", routeByIntent, {
        sdlc_subgraph: "sdlc_subgraph",
        hotfix_subgraph: "hotfix_subgraph",
        code_review_subgraph: "code_review_subgraph",
        docs_subgraph: "docs_subgraph",
        security_audit_subgraph: "security_audit_subgraph",
        chat_subgraph: "chat_subgraph",
    })
        // All subgraphs terminate to END
        .addEdge("sdlc_subgraph", langgraph_1.END)
        .addEdge("hotfix_subgraph", langgraph_1.END)
        .addEdge("code_review_subgraph", langgraph_1.END)
        .addEdge("docs_subgraph", langgraph_1.END)
        .addEdge("security_audit_subgraph", langgraph_1.END)
        .addEdge("chat_subgraph", langgraph_1.END);
    return graph.compile({ checkpointer });
}
/**
 * Route from classify_intent to the appropriate subgraph node.
 */
function routeByIntent(state) {
    switch (state.intent) {
        case "sdlc":
            return "sdlc_subgraph";
        case "hotfix":
            return "hotfix_subgraph";
        case "code_review":
            return "code_review_subgraph";
        case "docs":
            return "docs_subgraph";
        case "security_audit":
            return "security_audit_subgraph";
        case "chat":
        default:
            return "chat_subgraph";
    }
}
//# sourceMappingURL=router-graph.js.map