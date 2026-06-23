"use strict";
/**
 * ToolProxy — registers MCP tools with IDE, forwards calls to Backend.
 * Implements TDD §5.3 IToolProxy, §5.4 Proxy pattern.
 * Handles BR-6 (52 tools), BR-7 (identical schemas), BR-8 (<50ms overhead), BR-9 (error forwarding).
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
const vscode = __importStar(require("vscode"));
const HttpClient_1 = require("./HttpClient");
const ToolRegistry_1 = require("./ToolRegistry");
const FileProxyHandler_1 = require("./FileProxyHandler");
class ToolProxy {
    registry;
    connectionManager;
    fileProxy;
    disposables = [];
    outputChannel;
    constructor(connectionManager, outputChannel) {
        this.connectionManager = connectionManager;
        this.outputChannel = outputChannel;
        this.registry = new ToolRegistry_1.ToolRegistry();
        this.fileProxy = new FileProxyHandler_1.FileProxyHandler(outputChannel);
    }
    async registerTools(tools) {
        this.registry.update(tools);
        for (const tool of tools) {
            try {
                const disposable = vscode.lm.registerTool(tool.name, {
                    invoke: async (_options, _token) => {
                        const args = _options.input ?? {};
                        const result = await this.callTool(tool.name, args);
                        return new vscode.LanguageModelToolResult(result.content.map((block) => {
                            if (block.type === 'text') {
                                return new vscode.LanguageModelTextPart(block.text ?? '');
                            }
                            return new vscode.LanguageModelTextPart(JSON.stringify(block));
                        }));
                    },
                    prepareInvocation: async (_options, _token) => {
                        return {
                            invocationMessage: 'Calling ' + tool.name + '...',
                        };
                    },
                });
                this.disposables.push(disposable);
            }
            catch (error) {
                this.log('Failed to register tool ' + tool.name + ': ' + error.message);
            }
        }
        this.log('Registered ' + tools.length + ' tools');
    }
    async callTool(name, args) {
        if (!this.connectionManager.isConnected()) {
            return this.errorResult('BACKEND_UNAVAILABLE', 'Backend is not connected');
        }
        if (!this.registry.has(name)) {
            return this.errorResult('TOOL_NOT_FOUND', "Tool '" + name + "' not found");
        }
        try {
            // File Proxy: enrich args with file content if needed (Pattern 1 and Both)
            const enrichedArgs = await this.fileProxy.enrichWithFileContent(name, args);
            const client = this.connectionManager.getHttpClient();
            const result = await client.callTool({ tool_name: name, arguments: enrichedArgs });
            // File Proxy: write output file if Backend returned __file_output (Pattern 2 and Both)
            await this.fileProxy.handleFileOutput(result);
            // Remove __file_output from result before returning to caller (transparent)
            if (result.__file_output) {
                delete result.__file_output;
            }
            return result;
        }
        catch (error) {
            if (error instanceof FileProxyHandler_1.FileProxyError) {
                return this.errorResult(error.code, error.message);
            }
            if (error instanceof HttpClient_1.HttpError) {
                return this.errorResult('INTERNAL_ERROR', 'Tool execution failed: ' + error.body);
            }
            if (error.name === 'AbortError') {
                return this.errorResult('TIMEOUT', 'Tool call timed out');
            }
            return this.errorResult('BACKEND_UNAVAILABLE', 'Backend is not responding: ' + error.message);
        }
    }
    getRegisteredTools() {
        return this.registry.getDefinitions();
    }
    async refreshTools() {
        if (!this.connectionManager.isConnected())
            return;
        try {
            const client = this.connectionManager.getHttpClient();
            const response = await client.listTools();
            await this.registerTools(response.tools);
        }
        catch (error) {
            this.log('Failed to refresh tools: ' + error.message);
        }
    }
    dispose() {
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables.length = 0;
        this.registry.clear();
    }
    errorResult(code, message) {
        return {
            content: [{ type: 'text', text: 'Error [' + code + ']: ' + message }],
            isError: true,
        };
    }
    log(message) {
        this.outputChannel.appendLine('[ToolProxy] ' + message);
    }
}
exports.ToolProxy = ToolProxy;
//# sourceMappingURL=ToolProxy.js.map