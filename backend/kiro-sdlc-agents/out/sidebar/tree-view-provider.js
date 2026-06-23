"use strict";
/**
 * TreeViewProvider — Sidebar Activity Bar tree with KB panels and server status.
 * Shows warning badge on Activity Bar when KB system is inactive.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KiroTreeItem = exports.KiroTreeViewProvider = void 0;
const vscode = __importStar(require("vscode"));
class KiroTreeViewProvider {
    mcpManager;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    serverStatus = "stopped";
    treeView;
    isAuthenticated = false;
    username = "";
    constructor(mcpManager) {
        this.mcpManager = mcpManager;
        mcpManager.onStatusChange((status) => {
            this.serverStatus = status;
            this.updateBadge();
            this._onDidChangeTreeData.fire(undefined);
        });
    }
    /**
     * Bind the TreeView instance so we can update its badge.
     * Call this after vscode.window.createTreeView().
     */
    setTreeView(treeView) {
        this.treeView = treeView;
        this.updateBadge();
    }
    /** Update Activity Bar badge based on server status. */
    updateBadge() {
        if (!this.treeView) {
            return;
        }
        if (this.isKbInactive()) {
            this.treeView.badge = { value: 1, tooltip: "KB System Inactive \u2014 server not running" };
        }
        else {
            this.treeView.badge = undefined;
        }
    }
    /** KB is inactive when server is stopped or crashed. */
    isKbInactive() {
        return this.serverStatus === "stopped" || this.serverStatus === "crashed";
    }
    setAuthenticated(isAuthenticated, username = "") {
        this.isAuthenticated = isAuthenticated;
        this.username = username;
        this.refresh();
    }
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            return this.getRootItems();
        }
        return element.children || [];
    }
    getRootItems() {
        // Show warning banner when KB system is inactive
        const items = [];
        const config = vscode.workspace.getConfiguration("kiroSdlc");
        const backendUrl = config.get("backend.url") || "http://127.0.0.1:48721";
        if (this.isKbInactive()) {
            const warningItem = new KiroTreeItem("⚠️ KB System Inactive", vscode.TreeItemCollapsibleState.None);
            warningItem.iconPath = new vscode.ThemeIcon("warning", new vscode.ThemeColor("problemsWarningIcon.foreground"));
            warningItem.description = "Server not running";
            warningItem.command = { command: "kiroSdlc.restartMcpServer", title: "Restart Server", arguments: [] };
            items.push(warningItem);
        }
        else {
            const backendRootItem = new KiroTreeItem("Backend Target", vscode.TreeItemCollapsibleState.Expanded);
            backendRootItem.iconPath = new vscode.ThemeIcon("globe");
            backendRootItem.description = backendUrl;
            const authItem = new KiroTreeItem(this.isAuthenticated ? `Logged in as ${this.username}` : "Login Required", vscode.TreeItemCollapsibleState.None);
            authItem.iconPath = new vscode.ThemeIcon(this.isAuthenticated ? "account" : "key");
            authItem.command = {
                command: this.isAuthenticated ? "kiroSdlc.logout" : "kiroSdlc.login",
                title: this.isAuthenticated ? "Logout" : "Login",
                arguments: []
            };
            backendRootItem.children = [authItem];
            items.push(backendRootItem);
        }
        const kbSection = new KiroTreeItem("Knowledge Base", vscode.TreeItemCollapsibleState.Expanded);
        kbSection.children = [
            this.createCommandItem("Dashboard", "kiroSdlc.openKbDashboard", "dashboard"),
            this.createCommandItem("Graph", "kiroSdlc.openKbGraph", "type-hierarchy"),
            this.createCommandItem("Tags", "kiroSdlc.openKbTags", "tag"),
            this.createCommandItem("Quality", "kiroSdlc.openKbQuality", "star"),
            this.createCommandItem("Analytics", "kiroSdlc.openKbAnalytics", "graph"),
            this.createCommandItem("Workflow", "kiroSdlc.openWorkflowGraph", "circuit-board"),
        ];
        const serverSection = new KiroTreeItem("MCP Wrapper Server", vscode.TreeItemCollapsibleState.Expanded);
        const serverChildren = [];
        const statusItem = new KiroTreeItem(`Status: ${this.getStatusLabel()}`, vscode.TreeItemCollapsibleState.None);
        statusItem.iconPath = new vscode.ThemeIcon(this.getStatusIcon());
        const mcpServerPort = config.get("mcpServerPort", 9181);
        statusItem.description = `Port ${mcpServerPort}`;
        serverChildren.push(statusItem);
        serverChildren.push(this.createCommandItem("Edit Config", "kiroSdlc.editConfig", "json"));
        serverChildren.push(this.createCommandItem("Change Config...", "kiroSdlc.changeConfig", "folder-opened"));
        serverSection.children = serverChildren;
        const actionsSection = new KiroTreeItem("Quick Actions", vscode.TreeItemCollapsibleState.Collapsed);
        actionsSection.children = [
            this.createCommandItem("Inject All Agents", "kiroSdlc.injectAll", "cloud-download"),
            this.createCommandItem("Show Status", "kiroSdlc.status", "info"),
            this.createCommandItem("Index Workspace", "kiroSdlc.indexWorkspace", "search"),
            this.createCommandItem("Open KB in Browser", "kiroSdlc.openKbBrowser", "globe"),
        ];
        items.push(kbSection, serverSection, actionsSection);
        return items;
    }
    createCommandItem(label, command, icon) {
        const item = new KiroTreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.command = { command, title: label, arguments: [] };
        item.iconPath = new vscode.ThemeIcon(icon);
        item.contextValue = `cmd:${command}`;
        return item;
    }
    getStatusIcon() {
        switch (this.serverStatus) {
            case "running": return "check";
            case "starting": return "loading~spin";
            case "crashed": return "warning";
            case "stopped": return "circle-slash";
        }
    }
    getStatusLabel() {
        switch (this.serverStatus) {
            case "running": return "Running";
            case "starting": return "Starting...";
            case "crashed": return "Crashed";
            case "stopped": return "Stopped";
        }
    }
}
exports.KiroTreeViewProvider = KiroTreeViewProvider;
class KiroTreeItem extends vscode.TreeItem {
    children;
    constructor(label, collapsibleState) {
        super(label, collapsibleState);
    }
}
exports.KiroTreeItem = KiroTreeItem;
//# sourceMappingURL=tree-view-provider.js.map