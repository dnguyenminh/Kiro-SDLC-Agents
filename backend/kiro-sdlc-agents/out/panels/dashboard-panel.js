"use strict";
/**
 * DashboardPanel — KB Dashboard using MCP invokeTool for data.
 * mem_admin(dashboard) returns valid JSON: { metrics: {...}, recommendations: [...] }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardPanel = void 0;
const base_panel_1 = require("./base-panel");
class DashboardPanel extends base_panel_1.BasePanel {
    refreshTimer;
    constructor(mcpManager, extensionUri) {
        super("dashboard", mcpManager, extensionUri);
    }
    getHtml(webview) {
        return this.getIframeHtml();
    }
    async loadData() {
        // No-op: Data is loaded natively by the iframe
    }
    async handleMessage(msg) {
        // No-op: Webview communication is handled inside the iframe
    }
}
exports.DashboardPanel = DashboardPanel;
//# sourceMappingURL=dashboard-panel.js.map