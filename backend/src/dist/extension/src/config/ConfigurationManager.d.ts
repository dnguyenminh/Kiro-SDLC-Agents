/**
 * ConfigurationManager — reads VS Code settings for backend connection.
 * Implements TDD §5.1 ConfigurationManager.
 */
import * as vscode from 'vscode';
import { BackendConfiguration } from '../types/config';
export declare class ConfigurationManager {
    private static readonly SECTION;
    getConfiguration(): BackendConfiguration;
    onConfigurationChanged(listener: (config: BackendConfiguration) => void): vscode.Disposable;
}
//# sourceMappingURL=ConfigurationManager.d.ts.map