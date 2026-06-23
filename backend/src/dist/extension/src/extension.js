"use strict";
/**
 * Extension entry point — activate() / deactivate().
 * Implements TDD §5.1, FSD UC-1, BR-1 (activate < 2s).
 *
 * activate() MUST return within 2 seconds. All heavy operations
 * (Backend connection, tool registration) are async/non-blocking.
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ConfigurationManager_1 = require("./config/ConfigurationManager");
const ConnectionManager_1 = require("./connection/ConnectionManager");
const ToolProxy_1 = require("./proxy/ToolProxy");
const WebviewManager_1 = require("./webview/WebviewManager");
const StatusBarManager_1 = require("./ui/StatusBarManager");
const NotificationManager_1 = require("./ui/NotificationManager");
let connectionManager;
let toolProxy;
let webviewManager;
let statusBarManager;
async function activate(context) {
    const outputChannel = vscode.window.createOutputChannel('Code Intelligence');
    const configManager = new ConfigurationManager_1.ConfigurationManager();
    const notifications = new NotificationManager_1.NotificationManager();
    const config = configManager.getConfiguration();
    // Initialize status bar immediately (visible feedback)
    statusBarManager = new StatusBarManager_1.StatusBarManager();
    context.subscriptions.push(statusBarManager);
    // Initialize connection manager
    connectionManager = new ConnectionManager_1.ConnectionManager(config, outputChannel);
    context.subscriptions.push(connectionManager);
    // Initialize tool proxy
    toolProxy = new ToolProxy_1.ToolProxy(connectionManager, outputChannel);
    context.subscriptions.push(toolProxy);
    // Initialize webview manager
    webviewManager = new WebviewManager_1.WebviewManager(connectionManager, context.extensionUri);
    context.subscriptions.push(webviewManager);
    // Subscribe to state changes for UI updates
    const stateDisposable = connectionManager.onStateChange((state) => {
        statusBarManager?.updateState(state);
    });
    context.subscriptions.push(stateDisposable);
    // Register commands
    registerCommands(context, notifications);
    // Configuration change listener
    const configDisposable = configManager.onConfigurationChanged((_newConfig) => {
        notifications.showInfo('Configuration changed. Restart to apply.');
    });
    context.subscriptions.push(configDisposable);
    // Start async connection (non-blocking — BR-1)
    connectAndRegisterTools(outputChannel, notifications);
}
function deactivate() {
    connectionManager?.disconnect();
}
/**
 * Async connection + tool registration — runs after activate() returns.
 */
async function connectAndRegisterTools(outputChannel, notifications) {
    try {
        await connectionManager.connect();
        if (connectionManager.isConnected()) {
            await toolProxy.refreshTools();
        }
        else {
            outputChannel.appendLine('[Extension] Backend not available - tools in degraded mode');
        }
    }
    catch (error) {
        const msg = error.message;
        outputChannel.appendLine('[Extension] Connection error: ' + msg);
        notifications.showWarning('Could not connect to Backend. Tools will be available when Backend starts.', 'Retry').then((action) => {
            if (action === 'Retry') {
                connectAndRegisterTools(outputChannel, notifications);
            }
        });
    }
}
function registerCommands(context, notifications) {
    // Connection commands
    context.subscriptions.push(vscode.commands.registerCommand('codeIntel.reconnect', async () => {
        connectionManager?.disconnect();
        await connectionManager?.connect();
        if (connectionManager?.isConnected()) {
            await toolProxy?.refreshTools();
            notifications.showInfo('Reconnected to Backend');
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('codeIntel.disconnect', () => {
        connectionManager?.disconnect();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('codeIntel.showConnectionStatus', () => {
        const state = connectionManager?.state;
        if (state) {
            const version = state.backendVersion ?? 'N/A';
            const pid = state.backendPid ?? 'N/A';
            notifications.showInfo('State: ' + state.state + ' | Version: ' + version + ' | PID: ' + pid);
        }
    }));
    // Webview panel commands
    const panels = ['dashboard', 'kbGraph', 'analytics', 'tags', 'quality'];
    for (const panelId of panels) {
        context.subscriptions.push(vscode.commands.registerCommand('codeIntel.open' + panelId.charAt(0).toUpperCase() + panelId.slice(1), () => { webviewManager?.openPanel(panelId); }));
    }
}
//# sourceMappingURL=extension.js.map