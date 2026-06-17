/**
 * AnalyticsModule — handles analytics and quality scoring tools.
 * Implements TDD §5.2 modules/analytics/AnalyticsModule.ts.
 */
const ANALYTICS_TOOLS = [
// Analytics module doesn't have direct tool mappings in tool-list.txt
// It provides data via /api/* endpoints, handled by the API routes
];
export class AnalyticsModule {
    name = 'analytics';
    _status = 'initializing';
    get status() {
        return this._status;
    }
    async initialize() {
        console.log('[AnalyticsModule] Initializing...');
        this._status = 'ready';
        console.log('[AnalyticsModule] Ready');
    }
    async shutdown() {
        this._status = 'initializing';
        console.log('[AnalyticsModule] Shut down');
    }
    getToolHandlers() {
        return new Map();
    }
    getToolDefinitions() {
        return ANALYTICS_TOOLS;
    }
}
//# sourceMappingURL=AnalyticsModule.js.map