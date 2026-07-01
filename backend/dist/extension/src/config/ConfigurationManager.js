/**
 * ConfigurationManager — reads VS Code settings for remote backend connection.
 * KSA-292: Refactored to URL-based config (removed host/port/backendPath/autoStart).
 * Implements TDD §5.1 ConfigurationManager.
 */
import * as vscode from 'vscode';
import { DEFAULT_BACKEND_CONFIG } from '../types/config';
export class ConfigurationManager {
    static SECTION = 'codeIntel.backend';
    getConfiguration() {
        const vsConfig = vscode.workspace.getConfiguration(ConfigurationManager.SECTION);
        return {
            url: vsConfig.get('url', DEFAULT_BACKEND_CONFIG.url),
            ssoEnabled: vsConfig.get('ssoEnabled', DEFAULT_BACKEND_CONFIG.ssoEnabled),
            ssoProviderUrl: vsConfig.get('ssoProviderUrl', DEFAULT_BACKEND_CONFIG.ssoProviderUrl),
            healthCheckInterval: vsConfig.get('healthCheckInterval', DEFAULT_BACKEND_CONFIG.healthCheckInterval),
            toolCallTimeout: vsConfig.get('toolCallTimeout', DEFAULT_BACKEND_CONFIG.toolCallTimeout),
            chatTimeout: vsConfig.get('chatTimeout', DEFAULT_BACKEND_CONFIG.chatTimeout),
        };
    }
    onConfigurationChanged(listener) {
        return vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(ConfigurationManager.SECTION)) {
                listener(this.getConfiguration());
            }
        });
    }
    /**
     * Migrate legacy host+port settings to URL format (TDD §12.2).
     */
    async migrateIfNeeded() {
        const vsConfig = vscode.workspace.getConfiguration(ConfigurationManager.SECTION);
        const hasLegacyHost = vsConfig.inspect('host')?.workspaceValue !== undefined
            || vsConfig.inspect('host')?.globalValue !== undefined;
        const hasNewUrl = vsConfig.inspect('url')?.workspaceValue !== undefined
            || vsConfig.inspect('url')?.globalValue !== undefined;
        if (hasLegacyHost && !hasNewUrl) {
            const host = vsConfig.get('host', '127.0.0.1');
            const port = vsConfig.get('port', 48721);
            const url = 'http://' + host + ':' + port;
            await vsConfig.update('url', url, vscode.ConfigurationTarget.Global);
        }
    }
}
//# sourceMappingURL=ConfigurationManager.js.map