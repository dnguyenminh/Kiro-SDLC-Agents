/**
 * Configuration types for the Extension.
 * KSA-292: Refactored to URL-based remote backend (no local process).
 * Implements TDD §5.1 ConfigurationManager.
 */
export const DEFAULT_BACKEND_CONFIG = {
    url: 'http://127.0.0.1:48721',
    ssoEnabled: false,
    ssoProviderUrl: '',
    healthCheckInterval: 5000,
    toolCallTimeout: 300000,
    chatTimeout: 120000,
};
//# sourceMappingURL=config.js.map