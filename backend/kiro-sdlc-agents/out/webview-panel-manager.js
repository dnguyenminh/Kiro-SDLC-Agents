"use strict";
/**
 * WebviewPanelManager — Factory and singleton registry for KB webview panels.
 * Ensures only one instance of each panel type exists at a time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebviewPanelManager = void 0;
const graph_panel_1 = require("./panels/graph-panel");
const dashboard_panel_1 = require("./panels/dashboard-panel");
const tags_panel_1 = require("./panels/tags-panel");
const quality_panel_1 = require("./panels/quality-panel");
const analytics_panel_1 = require("./panels/analytics-panel");
const workflow_panel_1 = require("./panels/workflow-panel");
class WebviewPanelManager {
    mcpManager;
    extensionUri;
    eventBus;
    panels = new Map();
    constructor(mcpManager, extensionUri, eventBus) {
        this.mcpManager = mcpManager;
        this.extensionUri = extensionUri;
        this.eventBus = eventBus;
    }
    /**
     * Open a panel by type. If already open, reveals it. Otherwise creates new.
     */
    openPanel(type) {
        const existing = this.panels.get(type);
        if (existing && existing.isAlive) {
            existing.reveal();
            return;
        }
        // Remove stale reference if panel was disposed externally
        if (existing) {
            this.panels.delete(type);
        }
        const panel = this.createPanel(type);
        this.panels.set(type, panel);
        // Auto-remove from map when panel is disposed
        panel.onDispose(() => {
            this.panels.delete(type);
        });
        // Load initial data
        panel.loadData().catch((err) => {
            panel.sendMessage({
                type: "error",
                message: `Failed to load data: ${err.message}`,
                retryable: true,
            });
        });
    }
    /**
     * Get an existing panel instance (or undefined if not open).
     */
    getPanel(type) {
        const panel = this.panels.get(type);
        return panel?.isAlive ? panel : undefined;
    }
    /**
     * Dispose all open panels.
     */
    disposeAll() {
        for (const [, panel] of this.panels) {
            panel.dispose();
        }
        this.panels.clear();
    }
    /**
     * Send a message to all open panels (e.g., server status change).
     */
    notifyAllPanels(message) {
        for (const [, panel] of this.panels) {
            if (panel.isAlive) {
                panel.sendMessage(message);
            }
        }
    }
    dispose() {
        this.disposeAll();
    }
    /**
     * Factory method — creates the appropriate panel subclass.
     */
    createPanel(type) {
        switch (type) {
            case "graph":
                return new graph_panel_1.GraphPanel(this.mcpManager, this.extensionUri);
            case "dashboard":
                return new dashboard_panel_1.DashboardPanel(this.mcpManager, this.extensionUri);
            case "tags":
                return new tags_panel_1.TagsPanel(this.mcpManager, this.extensionUri, this.eventBus);
            case "quality":
                return new quality_panel_1.QualityPanel(this.mcpManager, this.extensionUri, this.eventBus);
            case "analytics":
                return new analytics_panel_1.AnalyticsPanel(this.mcpManager, this.extensionUri, this.eventBus);
            case "workflow":
                return new workflow_panel_1.WorkflowPanel(this.mcpManager, this.extensionUri);
        }
    }
}
exports.WebviewPanelManager = WebviewPanelManager;
//# sourceMappingURL=webview-panel-manager.js.map