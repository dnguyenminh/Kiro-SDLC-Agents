"use strict";
/**
 * Configuration types for the Extension.
 * Implements TDD §5.1 ConfigurationManager and FSD §3.1.4.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BACKEND_CONFIG = void 0;
exports.DEFAULT_BACKEND_CONFIG = {
    port: 48721,
    host: '127.0.0.1',
    backendPath: '',
    autoStart: true,
    healthCheckInterval: 5000,
    startupTimeout: 30000,
    compatRange: '>=1.0.0',
};
//# sourceMappingURL=config.js.map