/**
 * ToolProxy — registers MCP tools with IDE, forwards calls to Backend.
 * KSA-292: Added local/remote tool routing (TDD §4.3).
 * Local tools (embed_images) execute via FileProxyHandler.
 * Remote tools forward via HttpClient with auth.
 */
import * as vscode from 'vscode';
import { HttpError, AuthenticationRequiredError, RateLimitedError } from './HttpClient';
import { ToolRegistry } from './ToolRegistry';
import { FileProxyHandler, FileProxyError } from './FileProxyHandler';
/** Tools that execute entirely in the extension (no backend call) */
const LOCAL_TOOLS = new Set(['embed_images']);
export class ToolProxy {
    registry;
    connectionManager;
    fileProxy;
    disposables = [];
    outputChannel;
    constructor(connectionManager, outputChannel) {
        this.connectionManager = connectionManager;
        this.outputChannel = outputChannel;
        this.registry = new ToolRegistry();
        this.fileProxy = new FileProxyHandler(outputChannel);
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
        // Local tool routing (TDD §4.3)
        if (LOCAL_TOOLS.has(name)) {
            return this.executeLocalTool(name, args);
        }
        // Remote tool: requires connection
        if (!this.connectionManager.isConnected()) {
            return this.errorResult('BACKEND_UNAVAILABLE', 'Backend is not connected');
        }
        if (!this.registry.has(name)) {
            return this.errorResult('TOOL_NOT_FOUND', "Tool '" + name + "' not found");
        }
        try {
            // File Proxy: enrich args with file content if needed
            const enrichedArgs = await this.fileProxy.enrichWithFileContent(name, args);
            const client = this.connectionManager.getHttpClient();
            const result = await client.callTool({ tool_name: name, arguments: enrichedArgs });
            // File Proxy: write output file if Backend returned __file_output
            await this.fileProxy.handleFileOutput(result);
            // Remove __file_output from result before returning to caller
            if (result.__file_output) {
                delete result.__file_output;
            }
            return result;
        }
        catch (error) {
            if (error instanceof FileProxyError) {
                return this.errorResult(error.code, error.message);
            }
            if (error instanceof AuthenticationRequiredError) {
                return this.errorResult('AUTH_REQUIRED', 'Authentication required — please login');
            }
            if (error instanceof RateLimitedError) {
                return this.errorResult('RATE_LIMITED', 'Rate limited — retry after ' + error.retryAfterSeconds + 's');
            }
            if (error instanceof HttpError) {
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
    async executeLocalTool(name, args) {
        try {
            if (name === 'embed_images') {
                // Execute embed_images locally via FileProxyHandler
                const result = await this.fileProxy.enrichWithFileContent(name, args);
                return {
                    content: [{ type: 'text', text: JSON.stringify(result) }],
                    isError: false,
                };
            }
            return this.errorResult('TOOL_NOT_FOUND', "Local tool '" + name + "' not implemented");
        }
        catch (error) {
            if (error instanceof FileProxyError) {
                return this.errorResult(error.code, error.message);
            }
            return this.errorResult('LOCAL_TOOL_ERROR', error.message);
        }
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
//# sourceMappingURL=ToolProxy.js.map