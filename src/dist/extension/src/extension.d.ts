/**
 * Extension entry point — activate() / deactivate().
 * Implements TDD §5.1, FSD UC-1, BR-1 (activate < 2s).
 *
 * activate() MUST return within 2 seconds. All heavy operations
 * (Backend connection, tool registration) are async/non-blocking.
 */
import * as vscode from 'vscode';
export declare function activate(context: vscode.ExtensionContext): Promise<void>;
export declare function deactivate(): void;
//# sourceMappingURL=extension.d.ts.map