/**
 * ConfigurationManager — reads VS Code settings for the extension.
 * Implements: BR-1, BR-4
 */

import * as vscode from 'vscode';
import { BackendConfiguration, DEFAULT_CONFIG } from '../types/config';

export class ConfigurationManager {
  private static readonly SECTION = 'codeIntel.backend';

  getConfig(): BackendConfiguration {
    const config = vscode.workspace.getConfiguration(ConfigurationManager.SECTION);

    return {
      port: config.get<number>('port', DEFAULT_CONFIG.port),
      host: config.get<string>('host', DEFAULT_CONFIG.host),
      path: config.get<string>('path', DEFAULT_CONFIG.path),
      autoStart: config.get<boolean>('autoStart', DEFAULT_CONFIG.autoStart),
      healthCheckInterval: config.get<number>('healthCheckInterval', DEFAULT_CONFIG.healthCheckInterval),
      startupTimeout: config.get<number>('startupTimeout', DEFAULT_CONFIG.startupTimeout),
      compatRange: config.get<string>('compatRange', DEFAULT_CONFIG.compatRange),
    };
  }

  getBaseUrl(): string {
    const config = this.getConfig();
    return `http://${config.host}:${config.port}`;
  }

  onConfigChange(listener: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ConfigurationManager.SECTION)) {
        listener();
      }
    });
  }
}
