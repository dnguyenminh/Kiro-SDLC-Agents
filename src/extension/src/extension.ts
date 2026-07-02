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
import { ConfigurationManager } from './config/ConfigurationManager';
import { ConnectionManager } from './connection/ConnectionManager';
import { ToolProxy } from './proxy/ToolProxy';
import { WebviewManager } from './webview/WebviewManager';
import { StatusBarManager } from './ui/StatusBarManager';
import { NotificationManager } from './ui/NotificationManager';
import { AuthManager } from './auth/AuthManager';
import { TokenRefreshTimer } from './auth/TokenRefreshTimer';
import { LoginPanel } from './webview/panels/LoginPanel';
import { McpConfigPanel } from './webview/panels/McpConfigPanel';
import { ChatPanel } from './webview/panels/ChatPanel';
import { WorkspaceSyncService } from './services/WorkspaceSyncService';
import { IndexingService } from './services/IndexingService';
import { PanelType } from './types/config';

let connectionManager: ConnectionManager | undefined;
let toolProxy: ToolProxy | undefined;
let webviewManager: WebviewManager | undefined;
let statusBarManager: StatusBarManager | undefined;
let authManager: AuthManager | undefined;
let tokenRefreshTimer: TokenRefreshTimer | undefined;
let loginPanel: LoginPanel | undefined;
let mcpConfigPanel: McpConfigPanel | undefined;
let chatPanel: ChatPanel | undefined;
let workspaceSyncService: WorkspaceSyncService | undefined;
let indexingService: IndexingService | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel('Code Intelligence');
  const configManager = new ConfigurationManager();
  const notifications = new NotificationManager();

  await configManager.migrateIfNeeded();
  const config = configManager.getConfiguration();

  statusBarManager = new StatusBarManager();
  context.subscriptions.push(statusBarManager);

  authManager = new AuthManager(context.secrets);
  context.subscriptions.push(authManager);

  tokenRefreshTimer = new TokenRefreshTimer(authManager, config.url);
  context.subscriptions.push(tokenRefreshTimer);

  loginPanel = new LoginPanel(authManager, context.extensionUri, config.url);
  context.subscriptions.push(loginPanel);

  mcpConfigPanel = new McpConfigPanel(authManager, context.extensionUri, config.url);
  context.subscriptions.push(mcpConfigPanel);

  connectionManager = new ConnectionManager(config, authManager, outputChannel);
  context.subscriptions.push(connectionManager);

  toolProxy = new ToolProxy(connectionManager, outputChannel);
  context.subscriptions.push(toolProxy);

  webviewManager = new WebviewManager(connectionManager, context.extensionUri);
  context.subscriptions.push(webviewManager);

  const httpClient = connectionManager.getHttpClient();
  workspaceSyncService = new WorkspaceSyncService(httpClient, outputChannel);
  context.subscriptions.push(workspaceSyncService);

  indexingService = new IndexingService(httpClient, outputChannel);
  context.subscriptions.push(indexingService);

  chatPanel = new ChatPanel(httpClient, authManager, context.extensionUri, outputChannel);
  context.subscriptions.push(chatPanel);

  const stateDisposable = connectionManager.onStateChange((state) => {
    statusBarManager?.updateState(state);
  });
  context.subscriptions.push(stateDisposable);

  // When auth succeeds after login, register tools
  const authDisposable = authManager.onStateChange(async (state) => {
    if (state === 'AUTHENTICATED') {
      loginPanel?.close();
      tokenRefreshTimer?.start();
      outputChannel.appendLine('[Auth] Authenticated as ' + (authManager?.user?.username ?? 'unknown'));
      // After login success, connect to backend with new token
      await connectionManager?.connect();
      if (connectionManager?.isConnected()) {
        await toolProxy?.refreshTools();
        workspaceSyncService?.syncOnConnect().catch(() => {});
      }
    } else if (state === 'UNAUTHENTICATED') {
      tokenRefreshTimer?.stop();
      loginPanel?.show();
      outputChannel.appendLine('[Auth] Unauthenticated - Login required');
    }
  });
  context.subscriptions.push(authDisposable);

  registerCommands(context, notifications, outputChannel);

  const configDisposable = configManager.onConfigurationChanged(() => {
    notifications.showInfo('Configuration changed. Reconnect to apply.');
  });
  context.subscriptions.push(configDisposable);

  // FIX: Connect FIRST (health is skipAuth), then check auth
  initializeConnection(outputChannel);
}

export function deactivate(): void {
  tokenRefreshTimer?.stop();
  connectionManager?.disconnect();
}

async function initializeConnection(outputChannel: vscode.OutputChannel): Promise<void> {
  try {
    // Step 1: Check auth state (do we have stored tokens?)
    await authManager!.initialize();

    if (authManager!.isAuthenticated) {
      // Have valid token -> connect with auth
      await tokenRefreshTimer!.start();
      await connectionManager!.connect();
      if (connectionManager!.isConnected()) {
        await toolProxy!.refreshTools();
        workspaceSyncService?.syncOnConnect().catch(() => {});
        outputChannel.appendLine('[Extension] Authenticated + Connected');
      }
    } else {
      // No token -> show login panel, wait for user to login
      // After login success, authDisposable listener will trigger connect
      loginPanel!.show();
      outputChannel.appendLine('[Extension] No auth token - showing login');
    }
  } catch (error) {
    outputChannel.appendLine('[Extension] Init error: ' + (error as Error).message);
    loginPanel!.show();
  }
}

function registerCommands(
  context: vscode.ExtensionContext,
  notifications: NotificationManager,
  _outputChannel: vscode.OutputChannel,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('codeIntel.reconnect', async () => {
      connectionManager?.disconnect();
      await connectionManager?.connect();
      if (connectionManager?.isConnected()) {
        await toolProxy?.refreshTools();
        notifications.showInfo('Reconnected to Backend');
      }
    }),
    vscode.commands.registerCommand('codeIntel.disconnect', () => {
      connectionManager?.disconnect();
    }),
    vscode.commands.registerCommand('codeIntel.showConnectionStatus', () => {
      const state = connectionManager?.state;
      if (state) {
        const version = state.backendVersion ?? 'N/A';
        const authStatus = authManager?.isAuthenticated ? 'Authenticated' : 'Not authenticated';
        notifications.showInfo('State: ' + state.state + ' | Version: ' + version + ' | Auth: ' + authStatus);
      }
    }),
    vscode.commands.registerCommand('codeIntel.login', () => { loginPanel?.show(); }),
    vscode.commands.registerCommand('codeIntel.logout', async () => {
      if (!authManager?.isAuthenticated) { notifications.showInfo('Not currently authenticated.'); return; }
      const refreshToken = await authManager.getRefreshToken();
      if (refreshToken) {
        const cfg = new ConfigurationManager().getConfiguration();
        try { await fetch(cfg.url + '/api/admin/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }) }); } catch (error) { outputChannel.appendLine('[Extension] Logout request failed: ' + (error as Error).message); }
      }
      await authManager.clearTokens();
      tokenRefreshTimer?.stop();
    }),
    vscode.commands.registerCommand('codeIntel.configureMcpServers', () => {
      if (!authManager?.isAuthenticated) { notifications.showWarning('Please login first.'); loginPanel?.show(); return; }
      mcpConfigPanel?.show();
    }),
    vscode.commands.registerCommand('codeIntel.indexDocuments', async () => {
      if (!connectionManager?.isConnected()) { notifications.showWarning('Backend not connected.'); return; }
      await indexingService?.indexDocuments();
    }),
    vscode.commands.registerCommand('codeIntel.indexSource', async () => {
      if (!connectionManager?.isConnected()) { notifications.showWarning('Backend not connected.'); return; }
      await indexingService?.indexSource();
    }),
    vscode.commands.registerCommand('codeIntel.openChat', () => {
      if (!authManager?.isAuthenticated) { notifications.showWarning('Please login first.'); loginPanel?.show(); return; }
      chatPanel?.show();
    }),
    vscode.commands.registerCommand('codeIntel.configureBackend', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'codeIntel.backend');
    }),
  );

  const panels: PanelType[] = ['dashboard', 'kbGraph', 'analytics', 'tags', 'quality'];
  for (const panelId of panels) {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'codeIntel.open' + panelId.charAt(0).toUpperCase() + panelId.slice(1),
        () => { webviewManager?.openPanel(panelId); },
      ),
    );
  }
}
