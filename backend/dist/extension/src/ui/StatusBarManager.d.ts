/**
 * StatusBarManager — shows connection state indicator.
 * KSA-292: Removed STARTING state and backendPid.
 * Implements TDD §5.3 IStatusBarManager, FSD BR-15, BR-30.
 */
import * as vscode from 'vscode';
import { ConnectionState } from '../types/connection';
export declare class StatusBarManager implements vscode.Disposable {
    private readonly statusBarItem;
    constructor();
    updateState(state: ConnectionState): void;
    dispose(): void;
}
