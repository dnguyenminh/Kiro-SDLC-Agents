/**
 * Configuration types for the Extension.
 * Implements TDD §5.1 ConfigurationManager and FSD §3.1.4.
 */

export interface BackendConfiguration {
  port: number;
  host: string;
  backendPath: string;
  autoStart: boolean;
  healthCheckInterval: number;
  startupTimeout: number;
  compatRange: string;
}

export const DEFAULT_BACKEND_CONFIG: BackendConfiguration = {
  port: 48721,
  host: '127.0.0.1',
  backendPath: '',
  autoStart: true,
  healthCheckInterval: 5000,
  startupTimeout: 30000,
  compatRange: '>=1.0.0',
};

export type PanelType = 'dashboard' | 'kbGraph' | 'analytics' | 'tags' | 'quality';
