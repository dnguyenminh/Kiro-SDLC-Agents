"use strict";
/**
 * TagsPanel — Tag cloud and taxonomy tree with CRUD operations.
 * Real-time updates via KbEventBus SSE subscription + polling fallback.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TagsPanel = void 0;
const base_panel_1 = require("./base-panel");
class TagsPanel extends base_panel_1.BasePanel {
    refreshTimer;
    eventSubscription;
    constructor(mcpManager, extensionUri, eventBus) {
        super("tags", mcpManager, extensionUri);
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
exports.TagsPanel = TagsPanel;
//# sourceMappingURL=tags-panel.js.map