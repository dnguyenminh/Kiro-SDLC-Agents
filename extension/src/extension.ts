/**
 * Extension entry point — activate() and deactivate().
 * Lightweight activation: connects to Backend, registers tools, shows status.
 * Implements: BR-1 (activate < 2s), UC-1
 */

import * as vscode from 'vscode';
import { ConfigurationManager } from './config/ConfigurationManager';
import { ConnectionManager } from './connection/ConnectionManager';
import { ToolProxy } from './proxy/ToolProxy';
import { StatusBarManager } from './ui/StatusBarManager';
import { NotificationManager } from './ui/NotificationManager';
import { WebviewManager } from './webview/WebviewManager';

let connectionManager: ConnectionManager | undefined;
let statusBarManager: StatusBarManager | undefined;
let toolProxy: ToolProxy | undefined;
let webviewManager: WebviewManager | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel('Code Intelligence');
  const configManager = new ConfigurationManager();
  const notifications = new NotificationManager();
  const config = configManager.getConfig();

  outputChannel.appendLine('[Extension] Activating Code Intelligence extension...');

  // Initialize StatusBar first (instant visual feedback)
  statusBarManager = new StatusBarManager();
  context.subscriptions.push(statusBarManager);

  // Initialize ConnectionManager
  connectionManager = new ConnectionManager(config, outputChannel);
  context.subscriptions.push(connectionManager);

  // Wire state changes to StatusBar
  connectionManager.onStateChange((state) => {
    statusBarManager?.updateState(state);
  });

  // Initialize ToolProxy
  toolProxy = new ToolProxy(connectionManager.client, outputChannel);
  context.subscriptions.push(toolProxy);

  // Initialize WebviewManager
  webviewManager = new WebviewManager(connectionManager.client, outputChannel);
  context.subscriptions.push(webviewManager);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeIntel.reconnect', async () => {
      connectionManager?.disconnect();
      await connectionManager?.connect();
    }),
    vscode.commands.registerCommand('codeIntel.openDashboard', () => {
      webviewManager?.openPanel('dashboard');
    }),
    vscode.commands.registerCommand('codeIntel.openKBGraph', () => {
      webviewManager?.openPanel('kbGraph');
    }),
    vscode.commands.registerCommand('codeIntel.openAnalytics', () => {
      webviewManager?.openPanel('analytics');
    }),
    vscode.commands.registerCommand('codeIntel.showStatus', () => {
      const state = connectionManager?.currentState;
      if (state) {
        notifications.showInfo(
          `State: ${state.state}, Backend: v${state.backendVersion || 'unknown'}, PID: ${state.backendPid || 'N/A'}`
        );
      }
    })
  );

  // Listen for config changes
  context.subscriptions.push(
    configManager.onConfigChange(() => {
      outputChannel.appendLine('[Extension] Configuration changed, reconnecting...');
      connectionManager?.disconnect();
      // ConnectionManager will use new config on next connect
    })
  );

  // Connect to Backend (async, non-blocking)
  // activate() returns immediately per BR-1 (< 2s requirement)
  connectionManager.connect().then(async () => {
    if (connectionManager?.currentState.state === 'CONNECTED') {
      // Register tools after connection established
      await toolProxy?.registerTools();
      outputChannel.appendLine(`[Extension] ${toolProxy?.getToolCount()} tools registered`);
    }
  }).catch((err) => {
    outputChannel.appendLine(`[Extension] Initial connection failed: ${err}`);
  });

  outputChannel.appendLine('[Extension] Activation complete');
}

export function deactivate(): void {
  connectionManager?.disconnect();
}
