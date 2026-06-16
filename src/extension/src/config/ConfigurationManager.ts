/**
 * ConfigurationManager — reads VS Code settings for remote backend connection.
 * KSA-292: Refactored to URL-based config (removed host/port/backendPath/autoStart).
 * Implements TDD §5.1 ConfigurationManager.
 */

import * as vscode from 'vscode';
import { BackendConfiguration, DEFAULT_BACKEND_CONFIG } from '../types/config';

export class ConfigurationManager {
  private static readonly SECTION = 'codeIntel.backend';

  getConfiguration(): BackendConfiguration {
    const vsConfig = vscode.workspace.getConfiguration(ConfigurationManager.SECTION);

    return {
      url: vsConfig.get<string>('url', DEFAULT_BACKEND_CONFIG.url),
      ssoEnabled: vsConfig.get<boolean>('ssoEnabled', DEFAULT_BACKEND_CONFIG.ssoEnabled),
      ssoProviderUrl: vsConfig.get<string>('ssoProviderUrl', DEFAULT_BACKEND_CONFIG.ssoProviderUrl),
      healthCheckInterval: vsConfig.get<number>('healthCheckInterval', DEFAULT_BACKEND_CONFIG.healthCheckInterval),
      toolCallTimeout: vsConfig.get<number>('toolCallTimeout', DEFAULT_BACKEND_CONFIG.toolCallTimeout),
      chatTimeout: vsConfig.get<number>('chatTimeout', DEFAULT_BACKEND_CONFIG.chatTimeout),
    };
  }

  onConfigurationChanged(listener: (config: BackendConfiguration) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ConfigurationManager.SECTION)) {
        listener(this.getConfiguration());
      }
    });
  }

  /**
   * Migrate legacy host+port settings to URL format (TDD §12.2).
   */
  async migrateIfNeeded(): Promise<void> {
    const vsConfig = vscode.workspace.getConfiguration(ConfigurationManager.SECTION);
    const hasLegacyHost = vsConfig.inspect<string>('host')?.workspaceValue !== undefined
      || vsConfig.inspect<string>('host')?.globalValue !== undefined;
    const hasNewUrl = vsConfig.inspect<string>('url')?.workspaceValue !== undefined
      || vsConfig.inspect<string>('url')?.globalValue !== undefined;

    if (hasLegacyHost && !hasNewUrl) {
      const host = vsConfig.get<string>('host', '127.0.0.1');
      const port = vsConfig.get<number>('port', 48721);
      const url = 'http://' + host + ':' + port;
      await vsConfig.update('url', url, vscode.ConfigurationTarget.Global);
    }
  }
}
