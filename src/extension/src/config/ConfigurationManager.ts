/**
 * ConfigurationManager — reads VS Code settings for backend connection.
 * Implements TDD §5.1 ConfigurationManager.
 */

import * as vscode from 'vscode';
import { BackendConfiguration, DEFAULT_BACKEND_CONFIG } from '../types/config';

export class ConfigurationManager {
  private static readonly SECTION = 'codeIntel.backend';

  getConfiguration(): BackendConfiguration {
    const vsConfig = vscode.workspace.getConfiguration(ConfigurationManager.SECTION);

    return {
      port: vsConfig.get<number>('port', DEFAULT_BACKEND_CONFIG.port),
      host: vsConfig.get<string>('host', DEFAULT_BACKEND_CONFIG.host),
      backendPath: vsConfig.get<string>('backendPath', DEFAULT_BACKEND_CONFIG.backendPath),
      autoStart: vsConfig.get<boolean>('autoStart', DEFAULT_BACKEND_CONFIG.autoStart),
      healthCheckInterval: vsConfig.get<number>('healthCheckInterval', DEFAULT_BACKEND_CONFIG.healthCheckInterval),
      startupTimeout: vsConfig.get<number>('startupTimeout', DEFAULT_BACKEND_CONFIG.startupTimeout),
      compatRange: vsConfig.get<string>('compatRange', DEFAULT_BACKEND_CONFIG.compatRange),
    };
  }

  onConfigurationChanged(listener: (config: BackendConfiguration) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ConfigurationManager.SECTION)) {
        listener(this.getConfiguration());
      }
    });
  }
}
