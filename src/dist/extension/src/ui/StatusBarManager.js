"use strict";
/**
 * StatusBarManager — shows connection state indicator.
 * Implements TDD §5.3 IStatusBarManager, FSD BR-15, BR-30.
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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarManager {
    statusBarItem;
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'codeIntel.showConnectionStatus';
        this.updateState({
            state: 'DISCONNECTED',
            backendVersion: null,
            lastHealthCheck: 0,
            reconnectAttempts: 0,
            reconnectDelay: 1000,
            backendPid: null,
            connectedAt: null,
        });
        this.statusBarItem.show();
    }
    updateState(state) {
        switch (state.state) {
            case 'CONNECTED':
                this.statusBarItem.text = '$(check) Code Intel';
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = 'Backend v' + (state.backendVersion ?? 'unknown') + ' - Connected';
                break;
            case 'CONNECTING':
                this.statusBarItem.text = '$(sync~spin) Code Intel';
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = 'Connecting to Backend...';
                break;
            case 'STARTING':
                this.statusBarItem.text = '$(loading~spin) Code Intel';
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = 'Starting Backend...';
                break;
            case 'DISCONNECTED':
                this.statusBarItem.text = '$(error) Code Intel';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                this.statusBarItem.tooltip = state.reconnectAttempts > 0
                    ? 'Backend Disconnected (retry ' + state.reconnectAttempts + ')'
                    : 'Backend Disconnected';
                break;
        }
    }
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=StatusBarManager.js.map