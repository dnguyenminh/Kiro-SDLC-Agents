/**
 * StatusBarManager — shows connection state indicator.
 * KSA-292: Removed STARTING state and backendPid.
 * Implements TDD §5.3 IStatusBarManager, FSD BR-15, BR-30.
 */
import * as vscode from 'vscode';
export class StatusBarManager {
    statusBarItem;
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'codeIntel.showConnectionStatus';
        this.updateState({
            state: 'DISCONNECTED',
            backendVersion: null,
            lastHealthCheck: 0,
            reconnectAttempts: 0,
            reconnectDelay: 1000,
            connectedAt: null,
        });
        this.statusBarItem.show();
    }
    updateState(state) {
        switch (state.state) {
            case 'CONNECTED':
                this.statusBarItem.text = '$(check) Code Intel';
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = 'Backend v' + (state.backendVersion ?? 'unknown') + ' - Connected';
                break;
            case 'CONNECTING':
                this.statusBarItem.text = '$(sync~spin) Code Intel';
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = 'Connecting to Backend...';
                break;
            case 'DISCONNECTED':
                this.statusBarItem.text = '$(error) Code Intel';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                this.statusBarItem.tooltip = state.reconnectAttempts > 0
                    ? 'Backend Disconnected (retry ' + state.reconnectAttempts + ')'
                    : 'Backend Disconnected';
                break;
        }
    }
    dispose() {
        this.statusBarItem.dispose();
    }
}
//# sourceMappingURL=StatusBarManager.js.map