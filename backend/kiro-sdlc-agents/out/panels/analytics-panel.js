"use strict";
/**
 * AnalyticsPanel — Search volume, popular queries, gaps, recommendations.
 * Real-time updates via KbEventBus SSE subscription + polling fallback.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsPanel = void 0;
const base_panel_1 = require("./base-panel");
class AnalyticsPanel extends base_panel_1.BasePanel {
    refreshTimer;
    eventSubscription;
    constructor(mcpManager, extensionUri, eventBus) {
        super("analytics", mcpManager, extensionUri);
    }
    getHtml(webview) {
        return this.getIframeHtml();
    }
    async loadData() {
        // No-op
    }
    async handleMessage(msg) {
        // No-op
    }
}
exports.AnalyticsPanel = AnalyticsPanel;
//# sourceMappingURL=analytics-panel.js.map