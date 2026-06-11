/**
 * StatusBarManager — shows connection state indicator.
 * Implements TDD §5.3 IStatusBarManager, FSD BR-15, BR-30.
 */

import * as vscode from 'vscode';
import { ConnectionState } from '../types/connection';

export class StatusBarManager implements vscode.Disposable {
  private readonly statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'codeIntel.showConnectionStatus';
    this.updateState({
      state: 'DISCONNECTED',
      backendVersion: null,
      lastHealthCheck: 0,
      reconnectAttempts: 0,
      reconnectDelay: 1000,
      backendPid: null,
      connectedAt: null,
    });
    this.statusBarItem.show();
  }

  updateState(state: ConnectionState): void {
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
      case 'STARTING':
        this.statusBarItem.text = '$(loading~spin) Code Intel';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.tooltip = 'Starting Backend...';
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

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
