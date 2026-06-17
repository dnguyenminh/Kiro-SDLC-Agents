/**
 * BackendConfig — configuration for the Backend server.
 * Implements TDD §5.2 config/BackendConfig.ts.
 */
export interface BackendConfig {
    port: number;
    host: string;
    dbPath: string;
    modelsPath: string;
    orchestrationConfigPath: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    jwtSecret: string;
    encryptionKey: string;
}
export declare function loadConfig(): BackendConfig;
//# sourceMappingURL=BackendConfig.d.ts.map