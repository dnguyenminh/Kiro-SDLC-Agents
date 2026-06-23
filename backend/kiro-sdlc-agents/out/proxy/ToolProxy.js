"use strict";
/**
 * ToolProxy — Routes tool calls between local execution and remote backend.
 * Local tools (embed_images, etc.) run in-extension; everything else forwards to backend.
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
exports.ToolProxy = void 0;
const fs = __importStar(require("fs"));
class ToolProxy {
    httpClient;
    localTools = new Set();
    toolRegistry = new Map();
    constructor(httpClient) {
        this.httpClient = httpClient;
    }
    async refreshTools() {
        try {
            const tools = await this.httpClient.get("/mcp/tools/list");
            this.toolRegistry.clear();
            for (const tool of tools) {
                this.toolRegistry.set(tool.name, tool);
            }
        }
        catch { /* non-fatal */ }
    }
    async callTool(name, args) {
        if (this.localTools.has(name)) {
            return this.executeLocal(name, args);
        }
        // Wrapper: Read local file content before sending to remote backend
        const newArgs = { ...args };
        if (name === "mem_ingest_file" && typeof args.file_path === "string") {
            try {
                newArgs.content = fs.readFileSync(args.file_path, "utf-8");
            }
            catch (err) {
                return { content: [{ type: "text", text: `Wrapper Error: Cannot read local file ${args.file_path}: ${err.message}` }] };
            }
        }
        return this.httpClient.callTool(name, newArgs);
    }
    getAvailableTools() { return [...this.toolRegistry.values()]; }
    async invokeTool(name, args) {
        const result = await this.callTool(name, args);
        if (result.content && result.content.length > 0) {
            return result.content.map((c) => c.text).join("\n");
        }
        return "";
    }
    async executeLocal(name, args) {
        return { content: [{ type: "text", text: "Unknown local tool: " + name }] };
    }
}
exports.ToolProxy = ToolProxy;
//# sourceMappingURL=ToolProxy.js.map