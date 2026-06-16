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

export const DEFAULT_BACKEND_CONFIG: BackendConfiguration = {
  url: 'http://127.0.0.1:48721',
  ssoEnabled: false,
  ssoProviderUrl: '',
  healthCheckInterval: 5000,
  toolCallTimeout: 300000,
  chatTimeout: 120000,
};

export type PanelType = 'dashboard' | 'kbGraph' | 'analytics' | 'tags' | 'quality' | 'chat';
