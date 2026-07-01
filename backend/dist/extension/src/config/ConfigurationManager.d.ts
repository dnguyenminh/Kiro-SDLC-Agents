/**
 * ConfigurationManager — reads VS Code settings for remote backend connection.
 * KSA-292: Refactored to URL-based config (removed host/port/backendPath/autoStart).
 * Implements TDD §5.1 ConfigurationManager.
 */
import * as vscode from 'vscode';
import { BackendConfiguration } from '../types/config';
export declare class ConfigurationManager {
    private static readonly SECTION;
    getConfiguration(): BackendConfiguration;
    onConfigurationChanged(listener: (config: BackendConfiguration) => void): vscode.Disposable;
    /**
     * Migrate legacy host+port settings to URL format (TDD §12.2).
     */
    migrateIfNeeded(): Promise<void>;
}
