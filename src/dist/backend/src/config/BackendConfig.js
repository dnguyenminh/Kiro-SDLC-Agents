/**
 * BackendConfig — configuration for the Backend server.
 * Implements TDD §5.2 config/BackendConfig.ts.
 */
export function loadConfig() {
    return {
        port: parseInt(process.env.BACKEND_PORT ?? '48721', 10),
        host: process.env.BACKEND_HOST ?? '127.0.0.1',
        dbPath: process.env.DB_PATH ?? '.code-intel/index.db',
        modelsPath: process.env.MODELS_PATH ?? '.code-intel/models',
        orchestrationConfigPath: process.env.ORCHESTRATION_CONFIG ?? '.code-intel/orchestration.json',
        logLevel: process.env.LOG_LEVEL ?? 'info',
        jwtSecret: process.env.JWT_SECRET ?? 'code-intel-default-jwt-secret-change-in-production',
        encryptionKey: process.env.ENCRYPTION_KEY ?? 'code-intel-default-enc-key-change-me',
    };
}
//# sourceMappingURL=BackendConfig.js.map