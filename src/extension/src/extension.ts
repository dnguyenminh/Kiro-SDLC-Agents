/**
 * Extension entry point — activate() / deactivate().
 * Implements TDD §5.1, FSD UC-1, BR-1 (activate < 2s).
 *
 * activate() MUST return within 2 seconds. All heavy operations
 * (Backend connection, tool registration) are async/non-blocking.
 */

import * as vscode from 'vscode';
import { ConfigurationManager } from './config/ConfigurationManager';
import { ConnectionManager } from './connection/ConnectionManager';
import { ToolProxy } from './proxy/ToolProxy';
import { WebviewManager } from './webview/WebviewManager';
import { StatusBarManager } from './ui/StatusBarManager';
import { NotificationManager } from './ui/NotificationManager';
import { PanelType } from './types/config';

let connectionManager: ConnectionManager | undefined;
let toolProxy: ToolProxy | undefined;
let webviewManager: WebviewManager | undefined;
let statusBarManager: StatusBarManager | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel('Code Intelligence');
  const configManager = new ConfigurationManager();
  const notifications = new NotificationManager();
  const config = configManager.getConfiguration();

  // Initialize status bar immediately (visible feedback)
  statusBarManager = new StatusBarManager();
  context.subscriptions.push(statusBarManager);

  // Initialize connection manager
  connectionManager = new ConnectionManager(config, outputChannel);
  context.subscriptions.push(connectionManager);

  // Initialize tool proxy
  toolProxy = new ToolProxy(connectionManager, outputChannel);
  context.subscriptions.push(toolProxy);

  // Initialize webview manager
  webviewManager = new WebviewManager(connectionManager, context.extensionUri);
  context.subscriptions.push(webviewManager);

  // Subscribe to state changes for UI updates
  const stateDisposable = connectionManager.onStateChange((state) => {
    statusBarManager?.updateState(state);
  });
  context.subscriptions.push(stateDisposable);

  // Register commands
  registerCommands(context, notifications);

  // Configuration change listener
  const configDisposable = configManager.onConfigurationChanged((_newConfig) => {
    notifications.showInfo('Configuration changed. Restart to apply.');
  });
  context.subscriptions.push(configDisposable);

  // Start async connection (non-blocking — BR-1)
  connectAndRegisterTools(outputChannel, notifications);
}

export function deactivate(): void {
  connectionManager?.disconnect();
}

/**
 * Async connection + tool registration — runs after activate() returns.
 */
async function connectAndRegisterTools(
  outputChannel: vscode.OutputChannel,
  notifications: NotificationManager
): Promise<void> {
  try {
    await connectionManager!.connect();

    if (connectionManager!.isConnected()) {
      await toolProxy!.refreshTools();
    } else {
      outputChannel.appendLine('[Extension] Backend not available - tools in degraded mode');
    }
  } catch (error) {
    const msg = (error as Error).message;
    outputChannel.appendLine('[Extension] Connection error: ' + msg);
    notifications.showWarning(
      'Could not connect to Backend. Tools will be available when Backend starts.',
      'Retry'
    ).then((action) => {
      if (action === 'Retry') {
        connectAndRegisterTools(outputChannel, notifications);
      }
    });
  }
}

function registerCommands(
  context: vscode.ExtensionContext,
  notifications: NotificationManager
): void {
  // Connection commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeIntel.reconnect', async () => {
      connectionManager?.disconnect();
      await connectionManager?.connect();
      if (connectionManager?.isConnected()) {
        await toolProxy?.refreshTools();
        notifications.showInfo('Reconnected to Backend');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeIntel.disconnect', () => {
      connectionManager?.disconnect();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeIntel.showConnectionStatus', () => {
      const state = connectionManager?.state;
      if (state) {
        const version = state.backendVersion ?? 'N/A';
        const pid = state.backendPid ?? 'N/A';
        notifications.showInfo(
          'State: ' + state.state + ' | Version: ' + version + ' | PID: ' + pid
        );
      }
    })
  );

  // Webview panel commands
  const panels: PanelType[] = ['dashboard', 'kbGraph', 'analytics', 'tags', 'quality'];
  for (const panelId of panels) {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'codeIntel.open' + panelId.charAt(0).toUpperCase() + panelId.slice(1),
        () => { webviewManager?.openPanel(panelId); }
      )
    );
  }
}
