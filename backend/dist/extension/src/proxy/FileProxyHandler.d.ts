/**
 * FileProxyHandler — Extension acts as File Gateway for Backend.
 * Implements TDD §5.3 IFileProxyHandler, FSD §3.2.4 File Proxy Protocol.
 *
 * Backend has NO filesystem access. Extension reads/writes files on its behalf.
 * 3 Patterns:
 *   Pattern 1 (File Input): Extension reads file, injects content into args
 *   Pattern 2 (File Output): Backend returns data, Extension writes file
 *   Pattern 3 (Text Only): Forward as-is (no file handling)
 */
import * as vscode from 'vscode';
export interface FileOutput {
    path: string;
    data: string;
    encoding: 'utf-8' | 'base64';
}
export interface ToolResultWithFile {
    content: Array<{
        type: string;
        text?: string;
    }>;
    isError: boolean;
    __file_output?: FileOutput;
}
export type ToolPattern = 'file-input' | 'file-output' | 'file-both' | 'extension-local' | 'text-only';
export interface IFileProxyHandler {
    enrichWithFileContent(toolName: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
    handleFileOutput(response: ToolResultWithFile): Promise<void>;
    getToolPattern(toolName: string): ToolPattern;
}
export declare class FileProxyHandler implements IFileProxyHandler {
    private readonly workspaceRoot;
    private readonly outputChannel;
    constructor(outputChannel: vscode.OutputChannel);
    /**
     * Detect tool pattern based on tool name classification.
     */
    getToolPattern(toolName: string): ToolPattern;
    /**
     * Pattern 1 and 3 (Both): If tool needs file input, read file and inject content.
     * Returns enriched args with __file_content and __file_encoding.
     * Throws error if file not found or exceeds size limit.
     */
    enrichWithFileContent(toolName: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
    /**
     * Pattern 2 and 3 (Both): If response contains __file_output, write file to workspace.
     */
    handleFileOutput(response: ToolResultWithFile): Promise<void>;
    /**
     * Resolve relative path from workspace root to absolute path.
     * Prevents path traversal attacks.
     */
    private resolveRelativePath;
    /**
     * Detect if file is binary based on extension.
     */
    private isBinaryFile;
    private log;
}
/**
 * Custom error for file proxy operations.
 */
export declare class FileProxyError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
