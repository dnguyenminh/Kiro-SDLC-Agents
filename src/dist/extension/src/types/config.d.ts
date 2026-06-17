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
export declare const DEFAULT_BACKEND_CONFIG: BackendConfiguration;
export type PanelType = 'dashboard' | 'kbGraph' | 'analytics' | 'tags' | 'quality';
//# sourceMappingURL=config.d.ts.map