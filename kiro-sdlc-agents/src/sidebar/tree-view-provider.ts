/**
 * TreeViewProvider — Sidebar Activity Bar tree with KB panels and server status.
 * Shows warning badge on Activity Bar when KB system is inactive.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ServerStatus } from "../types";
import { McpServerManager } from "../mcp-server-manager";

export class KiroTreeViewProvider implements vscode.TreeDataProvider<KiroTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<KiroTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private serverStatus: ServerStatus = "stopped";
  private treeView: vscode.TreeView<KiroTreeItem> | undefined;

  constructor(private readonly mcpManager: McpServerManager) {
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
  setTreeView(treeView: vscode.TreeView<KiroTreeItem>): void {
    this.treeView = treeView;
    this.updateBadge();
  }

  /** Update Activity Bar badge based on server status. */
  private updateBadge(): void {
    if (!this.treeView) { return; }
    if (this.isKbInactive()) {
      this.treeView.badge = { value: 1, tooltip: "KB System Inactive \u2014 server not running" };
    } else {
      this.treeView.badge = undefined;
    }
  }

  /** KB is inactive when server is stopped or crashed. */
  isKbInactive(): boolean {
    return this.serverStatus === "stopped" || this.serverStatus === "crashed";
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: KiroTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: KiroTreeItem): KiroTreeItem[] {
    if (!element) { return this.getRootItems(); }
    return element.children || [];
  }

  private getRootItems(): KiroTreeItem[] {
    // Show warning banner when KB system is inactive
    const items: KiroTreeItem[] = [];

    if (this.isKbInactive()) {
      const warningItem = new KiroTreeItem(
        "\u26A0\uFE0F KB System Inactive",
        vscode.TreeItemCollapsibleState.None
      );
      warningItem.iconPath = new vscode.ThemeIcon("warning", new vscode.ThemeColor("problemsWarningIcon.foreground"));
      warningItem.description = "Server not running";
      warningItem.command = { command: "kiroSdlc.restartMcpServer", title: "Restart Server", arguments: [] };
      items.push(warningItem);
    } else {
      const runningItem = new KiroTreeItem(
        "\u2705 Running",
        vscode.TreeItemCollapsibleState.None
      );
      runningItem.iconPath = new vscode.ThemeIcon("check", new vscode.ThemeColor("testing.iconPassed"));
      runningItem.description = this.mcpManager.port ? `Port ${this.mcpManager.port}` : "";
      items.push(runningItem);
    }

    const kbSection = new KiroTreeItem("Knowledge Base", vscode.TreeItemCollapsibleState.Expanded);
    kbSection.children = [
      this.createCommandItem("Dashboard", "kiroSdlc.openKbDashboard", "dashboard"),
      this.createCommandItem("Graph", "kiroSdlc.openKbGraph", "type-hierarchy"),
      this.createCommandItem("Tags", "kiroSdlc.openKbTags", "tag"),
      this.createCommandItem("Quality", "kiroSdlc.openKbQuality", "star"),
      this.createCommandItem("Analytics", "kiroSdlc.openKbAnalytics", "graph"),
    ];

    const serverSection = new KiroTreeItem("MCP Server", vscode.TreeItemCollapsibleState.Expanded);
    const statusItem = new KiroTreeItem(`Status: ${this.getStatusLabel()}`, vscode.TreeItemCollapsibleState.None);
    statusItem.iconPath = new vscode.ThemeIcon(this.getStatusIcon());
    statusItem.description = this.mcpManager.port ? `Port ${this.mcpManager.port}` : "";
    const restartItem = this.createCommandItem("Restart Server", "kiroSdlc.restartMcpServer", "debug-restart");
    const serverChildren = [statusItem, restartItem];

    // Show Start or Stop based on current state
    if (this.isKbInactive()) {
      serverChildren.push(this.createCommandItem("Start Server", "kiroSdlc.restartMcpServer", "play"));
    } else {
      serverChildren.push(this.createCommandItem("Stop Server", "kiroSdlc.stopMcpServer", "debug-stop"));
    }
    serverChildren.push(this.createCommandItem("Change Port...", "kiroSdlc.changePort", "settings-gear"));
    serverChildren.push(this.createCommandItem("Edit Config", "kiroSdlc.editConfig", "json"));
    serverChildren.push(this.createCommandItem("Change Config...", "kiroSdlc.changeConfig", "folder-opened"));
    serverSection.children = serverChildren;

    const modelSection = new KiroTreeItem("Embedding Model", vscode.TreeItemCollapsibleState.Expanded);
    modelSection.children = this.getModelItems();

    const actionsSection = new KiroTreeItem("Quick Actions", vscode.TreeItemCollapsibleState.Collapsed);
    actionsSection.children = [
      this.createCommandItem("Inject All Agents", "kiroSdlc.injectAll", "cloud-download"),
      this.createCommandItem("Show Status", "kiroSdlc.status", "info"),
      this.createCommandItem("Index Workspace", "kiroSdlc.indexWorkspace", "search"),
      this.createCommandItem("Open KB in Browser", "kiroSdlc.openKbBrowser", "globe"),
    ];

    items.push(kbSection, serverSection, modelSection, actionsSection);
    return items;
  }

  private createCommandItem(label: string, command: string, icon: string): KiroTreeItem {
    const item = new KiroTreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.command = { command, title: label, arguments: [] };
    item.iconPath = new vscode.ThemeIcon(icon);
    item.contextValue = `cmd:${command}`;
    return item;
  }

  private getStatusIcon(): string {
    switch (this.serverStatus) {
      case "running": return "check";
      case "starting": return "loading~spin";
      case "crashed": return "warning";
      case "stopped": return "circle-slash";
    }
  }

  private getStatusLabel(): string {
    switch (this.serverStatus) {
      case "running": return "Running";
      case "starting": return "Starting...";
      case "crashed": return "Crashed";
      case "stopped": return "Stopped";
    }
  }

  private getModelItems(): KiroTreeItem[] {
    const modelsDir = path.join(
      process.env.HOME ?? process.env.USERPROFILE ?? "~", ".code-intel", "models"
    );
    const registryPath = path.join(modelsDir, "registry.json");
    let activeModel = "none";
    let hasModel = false;

    try {
      if (fs.existsSync(registryPath)) {
        const reg = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
        activeModel = reg.active_model ?? "none";
      }
      const modelFile = path.join(modelsDir, activeModel, "model.onnx");
      hasModel = fs.existsSync(modelFile);
    } catch { /* ignore */ }

    const items: KiroTreeItem[] = [];

    if (hasModel) {
      const statusItem = new KiroTreeItem(
        `\u2705 ${activeModel}`, vscode.TreeItemCollapsibleState.None
      );
      statusItem.iconPath = new vscode.ThemeIcon("check", new vscode.ThemeColor("testing.iconPassed"));
      statusItem.description = "Active";
      items.push(statusItem);
    } else {
      const missingItem = new KiroTreeItem(
        "\u274C No model installed", vscode.TreeItemCollapsibleState.None
      );
      missingItem.iconPath = new vscode.ThemeIcon("warning", new vscode.ThemeColor("problemsWarningIcon.foreground"));
      missingItem.description = "Semantic search disabled";
      items.push(missingItem);
    }

    items.push(this.createCommandItem("Download / Switch Model...", "kiroSdlc.downloadModel", "cloud-download"));
    return items;
  }
}

export class KiroTreeItem extends vscode.TreeItem {
  children?: KiroTreeItem[];
  constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(label, collapsibleState);
  }
}
