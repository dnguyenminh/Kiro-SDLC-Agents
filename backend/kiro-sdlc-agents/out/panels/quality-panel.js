"use strict";
/**
 * QualityPanel — Quality scores histogram, low-quality table, bulk actions.
 * Real-time updates via KbEventBus SSE subscription + polling fallback.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityPanel = void 0;
const base_panel_1 = require("./base-panel");
class QualityPanel extends base_panel_1.BasePanel {
    refreshTimer;
    eventSubscription;
    constructor(mcpManager, extensionUri, eventBus) {
        super("quality", mcpManager, extensionUri);
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
exports.QualityPanel = QualityPanel;
//# sourceMappingURL=quality-panel.js.map