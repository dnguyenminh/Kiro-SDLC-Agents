"use strict";
/**
 * ContextResolverProvider — Main orchestrator for resolving context data
 * KSA-252
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextResolverProvider = void 0;
const FileTreeProvider_1 = require("./FileTreeProvider");
const GitDiffProvider_1 = require("./GitDiffProvider");
const TerminalProvider_1 = require("./TerminalProvider");
const DiagnosticsProvider_1 = require("./DiagnosticsProvider");
const SpecProvider_1 = require("./SpecProvider");
const SteeringProvider_1 = require("./SteeringProvider");
const McpProvider_1 = require("./McpProvider");
const CurrentFileProvider_1 = require("./CurrentFileProvider");
class ContextResolverProvider {
    fileTree;
    gitDiff;
    terminal;
    diagnostics;
    spec;
    steering;
    mcp;
    currentFile;
    constructor(context) {
        this.fileTree = new FileTreeProvider_1.FileTreeProvider(context.workspaceRoot);
        this.gitDiff = new GitDiffProvider_1.GitDiffProvider(context.workspaceRoot);
        this.terminal = new TerminalProvider_1.TerminalProvider(context);
        this.diagnostics = new DiagnosticsProvider_1.DiagnosticsProvider(context);
        this.spec = new SpecProvider_1.SpecProvider(context.workspaceRoot);
        this.steering = new SteeringProvider_1.SteeringProvider(context.workspaceRoot);
        this.mcp = new McpProvider_1.McpProvider(context);
        this.currentFile = new CurrentFileProvider_1.CurrentFileProvider(context);
    }
    async handleMessage(message) {
        const requestId = message.requestId || '';
        try {
            switch (message.type) {
                case 'getWorkspaceFileTree':
                    return { type: 'workspaceFileTree', data: await this.fileTree.getTree(), requestId };
                case 'getWorkspaceFolderTree':
                    return { type: 'workspaceFolderTree', data: await this.fileTree.getFolderTree(), requestId };
                case 'getSpecList':
                    return { type: 'specList', data: await this.spec.getList(), requestId };
                case 'getSteeringFiles':
                    return { type: 'steeringFiles', data: await this.steering.getList(), requestId };
                case 'getMcpResources':
                    return { type: 'mcpResources', data: await this.mcp.getResources(), requestId };
                case 'getActiveFileName':
                    return { type: 'activeFileName', data: this.currentFile.getFileName(), requestId };
                case 'resolveGitDiff':
                    return { type: 'gitDiff', data: await this.gitDiff.getDiff(), requestId };
                case 'resolveTerminalOutput':
                    return { type: 'terminalOutput', data: this.terminal.getOutput(message.lines), requestId };
                case 'resolveDiagnostics':
                    return { type: 'diagnostics', data: this.diagnostics.getAll(), requestId };
                case 'resolveFileContent':
                    return { type: 'fileContent', data: await this.fileTree.readFiles(message.paths), requestId };
                case 'resolveSpecContent':
                    return { type: 'specContent', data: await this.spec.getContent(message.specName), requestId };
                case 'resolveSteeringContent':
                    return { type: 'steeringContent', data: await this.steering.getContent(message.fileName), requestId };
                case 'resolveMcpResource':
                    return { type: 'mcpResourceContent', data: await this.mcp.getResourceContent(message.server, message.resource), requestId };
                case 'resolveFolderListing':
                    return { type: 'folderListing', data: await this.fileTree.listFolder(message.folderPath), requestId };
                default:
                    return { type: 'error', message: `Unknown request type: ${message.type}`, requestType: message.type, requestId };
            }
        }
        catch (err) {
            return { type: 'error', message: err.message, requestType: message.type, requestId };
        }
    }
    dispose() {
        // Cleanup if needed
    }
}
exports.ContextResolverProvider = ContextResolverProvider;
//# sourceMappingURL=ContextResolverProvider.js.map