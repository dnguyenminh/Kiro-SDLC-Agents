/**
 * Extension entry point — activate() / deactivate().
 * KSA-292: Refactored to thin client of remote backend.
 * - Removed BackendProcess dependency
 * - Added WorkspaceSyncService, IndexingService, ChatPanel
 * - ConnectionManager now URL-based with AuthManager injection
 *
 * activate() MUST return within 2 seconds. All heavy operations
 * (Backend connection, workspace sync) are async/non-blocking.
 */
import * as vscode from 'vscode';
export declare function activate(context: vscode.ExtensionContext): Promise<void>;
export declare function deactivate(): void;
