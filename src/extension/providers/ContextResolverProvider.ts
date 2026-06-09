/**
 * ContextResolverProvider — Main orchestrator for resolving context data
 * KSA-252
 */

import type { ContextRequest, ContextResponse } from '../../shared/protocol';
import { FileTreeProvider } from './FileTreeProvider';
import { GitDiffProvider } from './GitDiffProvider';
import { TerminalProvider } from './TerminalProvider';
import { DiagnosticsProvider } from './DiagnosticsProvider';
import { SpecProvider } from './SpecProvider';
import { SteeringProvider } from './SteeringProvider';
import { McpProvider } from './McpProvider';
import { CurrentFileProvider } from './CurrentFileProvider';

interface VsCodeExtensionContext {
  workspaceRoot: string;
  getActiveEditorPath(): string | null;
  getTerminalOutput(lines?: number): string;
  getDiagnostics(): Array<{ file: string; line: number; severity: string; message: string; source?: string }>;
  getMcpResources(): Array<{ server: string; name: string; type: string; description?: string }>;
}

export class ContextResolverProvider {
  private fileTree: FileTreeProvider;
  private gitDiff: GitDiffProvider;
  private terminal: TerminalProvider;
  private diagnostics: DiagnosticsProvider;
  private spec: SpecProvider;
  private steering: SteeringProvider;
  private mcp: McpProvider;
  private currentFile: CurrentFileProvider;

  constructor(context: VsCodeExtensionContext) {
    this.fileTree = new FileTreeProvider(context.workspaceRoot);
    this.gitDiff = new GitDiffProvider(context.workspaceRoot);
    this.terminal = new TerminalProvider(context);
    this.diagnostics = new DiagnosticsProvider(context);
    this.spec = new SpecProvider(context.workspaceRoot);
    this.steering = new SteeringProvider(context.workspaceRoot);
    this.mcp = new McpProvider(context);
    this.currentFile = new CurrentFileProvider(context);
  }

  async handleMessage(message: ContextRequest): Promise<ContextResponse> {
    const requestId = (message as any).requestId || '';

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
          return { type: 'error', message: `Unknown request type: ${(message as any).type}`, requestType: (message as any).type, requestId };
      }
    } catch (err) {
      return { type: 'error', message: (err as Error).message, requestType: message.type, requestId };
    }
  }

  dispose(): void {
    // Cleanup if needed
  }
}
