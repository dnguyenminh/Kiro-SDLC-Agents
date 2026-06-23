"use strict";
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
exports.KbEventBus = void 0;
const vscode = __importStar(require("vscode"));
const EVENT_PANEL_MAP = {
    kb_entry_added: ["tags", "quality", "analytics"],
    kb_entry_updated: ["quality", "analytics"],
    kb_entry_deleted: ["tags", "quality", "analytics"],
    tag_created: ["tags"],
    tag_deleted: ["tags"],
    tag_updated: ["tags"],
    quality_scored: ["quality"],
    bulk_operation: ["tags", "quality", "analytics"],
    consolidation_complete: ["tags", "quality", "analytics"],
};
class KbEventBus {
    outputChannel;
    remoteClient;
    disposed = false;
    debounceTimers = new Map();
    notificationSub;
    static DEBOUNCE_MS = 500;
    _onTagsChange = new vscode.EventEmitter();
    _onQualityChange = new vscode.EventEmitter();
    _onAnalyticsChange = new vscode.EventEmitter();
    onTagsChange = this._onTagsChange.event;
    onQualityChange = this._onQualityChange.event;
    onAnalyticsChange = this._onAnalyticsChange.event;
    constructor(outputChannel, remoteClient) {
        this.outputChannel = outputChannel;
        this.remoteClient = remoteClient;
    }
    connect() {
        if (this.disposed)
            return;
        this.disconnect();
        this.outputChannel.appendLine(`[KbEventBus] Subscribing to MCP notifications`);
        this.notificationSub = this.remoteClient.onNotification((notification) => {
            this.handleNotification(notification);
        });
    }
    disconnect() {
        if (this.notificationSub) {
            this.notificationSub.dispose();
            this.notificationSub = undefined;
        }
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }
    dispose() {
        this.disposed = true;
        this.disconnect();
        this._onTagsChange.dispose();
        this._onQualityChange.dispose();
        this._onAnalyticsChange.dispose();
    }
    handleNotification(notification) {
        const method = notification.method;
        const prefix = "notifications/";
        const eventType = method.startsWith(prefix) ? method.slice(prefix.length) : method;
        if (!EVENT_PANEL_MAP[eventType])
            return;
        try {
            const event = {
                type: eventType,
                timestamp: Date.now(),
                data: notification.params || {}
            };
            this.dispatchEvent(event);
        }
        catch {
            // Ignore
        }
    }
    dispatchEvent(event) {
        const panels = EVENT_PANEL_MAP[event.type];
        if (!panels)
            return;
        for (const panel of panels) {
            this.debouncedEmit(panel, event);
        }
    }
    debouncedEmit(panel, event) {
        const existing = this.debounceTimers.get(panel);
        if (existing)
            clearTimeout(existing);
        const timer = setTimeout(() => {
            this.debounceTimers.delete(panel);
            switch (panel) {
                case "tags":
                    this._onTagsChange.fire(event);
                    break;
                case "quality":
                    this._onQualityChange.fire(event);
                    break;
                case "analytics":
                    this._onAnalyticsChange.fire(event);
                    break;
            }
        }, KbEventBus.DEBOUNCE_MS);
        this.debounceTimers.set(panel, timer);
    }
}
exports.KbEventBus = KbEventBus;
//# sourceMappingURL=kb-event-bus.js.map