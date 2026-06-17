/**
 * StatusBarManager — shows connection state in VS Code status bar.
 * Implements: BR-15, BR-30
 */

import * as vscode from 'vscode';
import type { ConnectionState } from '../types/connection';

export class StatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'codeIntel.showStatus';
    this.statusBarItem.show();
    this.updateState({ state: 'DISCONNECTED', backendVersion: null, lastHealthCheck: 0, reconnectAttempts: 0, reconnectDelay: 1000, backendPid: null, connectedAt: null });
  }

  updateState(state: ConnectionState): void {
    switch (state.state) {
      case 'CONNECTED':
        this.statusBarItem.text = '$(check) Code Intel';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.tooltip = `Backend v${state.backendVersion} — Connected${state.connectedAt ? ` (uptime: ${this.formatUptime(state.connectedAt)})` : ''}`;
        break;
      case 'CONNECTING':
        this.statusBarItem.text = '$(sync~spin) Code Intel';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        this.statusBarItem.tooltip = 'Connecting to Backend...';
        break;
      case 'STARTING':
        this.statusBarItem.text = '$(loading~spin) Code Intel';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        this.statusBarItem.tooltip = 'Starting Backend...';
        break;
      case 'DISCONNECTED':
        this.statusBarItem.text = '$(error) Code Intel';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.statusBarItem.tooltip = 'Backend Disconnected — Click to retry';
        break;
    }
  }

  private formatUptime(connectedAt: number): string {
    const seconds = Math.floor((Date.now() - connectedAt) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
