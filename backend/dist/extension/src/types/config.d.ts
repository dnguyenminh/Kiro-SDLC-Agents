/**
 * Configuration types for the Extension.
 * KSA-292: Refactored to URL-based remote backend (no local process).
 * Implements TDD §5.1 ConfigurationManager.
 */
export interface BackendConfiguration {
    url: string;
    ssoEnabled: boolean;
    ssoProviderUrl: string;
    healthCheckInterval: number;
    toolCallTimeout: number;
    chatTimeout: number;
}
export declare const DEFAULT_BACKEND_CONFIG: BackendConfiguration;
export type PanelType = 'dashboard' | 'kbGraph' | 'analytics' | 'tags' | 'quality' | 'chat';
