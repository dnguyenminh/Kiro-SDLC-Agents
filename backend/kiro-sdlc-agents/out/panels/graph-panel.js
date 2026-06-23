"use strict";
/**
 * GraphPanel — KB Graph viewer via iframe (shared viewer on MCP port).
 * Uses same viewer as browser (http://localhost:PORT/) for consistent results.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphPanel = void 0;
const base_panel_1 = require("./base-panel");
class GraphPanel extends base_panel_1.BasePanel {
    constructor(mcpManager, extensionUri) {
        super("graph", mcpManager, extensionUri);
    }
    getHtml(webview) {
        return this.getIframeHtml();
    }
    async loadData() {
        // No-op: iframe loads data directly from MCP server API
    }
    async handleMessage(msg) {
        // No-op: iframe handles all interactions internally
    }
}
exports.GraphPanel = GraphPanel;
//# sourceMappingURL=graph-panel.js.map