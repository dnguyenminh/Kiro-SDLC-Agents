/**
 * FileProxyHandler — handles file input/output for tools that operate on files.
 * Detects tools that need file content injected into args or output written to disk.
 * Implements: IFileProxyHandler from TDD §5.3
 */

import * as vscode from 'vscode';

export interface FileOutput {
  path: string;
  data: string;
  encoding: 'utf-8' | 'base64';
}

type ToolPattern = 'file-input' | 'file-output' | 'file-both' | 'text-only';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const FILE_INPUT_TOOLS = ['mem_ingest_file', 'drawio_auto_layout'];
const FILE_OUTPUT_TOOLS = ['stream_write_file'];
const FILE_BOTH_TOOLS = ['drawio_export_png', 'export_docx'];
const EXTENSION_LOCAL_TOOLS = ['embed_images'];

export class FileProxyHandler {
  getToolPattern(toolName: string): ToolPattern {
    if (FILE_INPUT_TOOLS.includes(toolName)) return 'file-input';
    if (FILE_OUTPUT_TOOLS.includes(toolName)) return 'file-output';
    if (FILE_BOTH_TOOLS.includes(toolName)) return 'file-both';
    return 'text-only';
  }

  isLocalOnly(toolName: string): boolean {
    return EXTENSION_LOCAL_TOOLS.includes(toolName);
  }

  /**
   * For file-input tools: read file from workspace and inject content into args.
   */
  async enrichWithFileContent(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const pattern = this.getToolPattern(toolName);
    if (pattern !== 'file-input' && pattern !== 'file-both') {
      return args;
    }

    const filePath = args.file_path as string | undefined;
    if (!filePath) return args;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return args;

    const fullPath = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);

    try {
      const stat = await vscode.workspace.fs.stat(fullPath);
      if (stat.size > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${stat.size} bytes (max: ${MAX_FILE_SIZE})`);
      }

      const content = await vscode.workspace.fs.readFile(fullPath);
      const text = Buffer.from(content).toString('utf-8');

      return { ...args, __file_content: text };
    } catch (err) {
      // If file cannot be read, pass args as-is and let Backend handle the error
      return args;
    }
  }

  /**
   * For file-output tools: write response file output to workspace.
   */
  async handleFileOutput(response: { __file_output?: FileOutput }): Promise<void> {
    const fileOutput = response.__file_output;
    if (!fileOutput) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const fullPath = vscode.Uri.joinPath(workspaceFolders[0].uri, fileOutput.path);

    const data = fileOutput.encoding === 'base64'
      ? Buffer.from(fileOutput.data, 'base64')
      : Buffer.from(fileOutput.data, 'utf-8');

    await vscode.workspace.fs.writeFile(fullPath, data);
  }
}
