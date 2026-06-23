"use strict";
/**
 * HookCommands — KSA-249
 * Registers VS Code commands for userTriggered hooks.
 * Each hook with when.type === "userTriggered" gets a command:
 *   kiro-sdlc.hook.{sanitized-name}
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
exports.HookCommands = void 0;
const vscode = __importStar(require("vscode"));
const hook_loader_1 = require("./hook-loader");
const hook_executor_1 = require("./hook-executor");
class HookCommands {
    disposables = [];
    executor;
    outputChannel;
    workspaceRoot;
    constructor(workspaceRoot, outputChannel) {
        this.workspaceRoot = workspaceRoot;
        this.outputChannel = outputChannel;
        this.executor = new hook_executor_1.HookExecutor(outputChannel);
    }
    /**
     * Register VS Code commands for all userTriggered hooks.
     * Disposes previous registrations before re-registering.
     */
    async registerCommands() {
        this.dispose();
        const hooks = await (0, hook_loader_1.loadHooks)(this.workspaceRoot);
        const userTriggered = hooks.filter(h => h.when.type === "userTriggered" && h.enabled !== false);
        for (const hook of userTriggered) {
            const commandId = `kiro-sdlc.hook.${this.sanitizeName(hook.name)}`;
            const disposable = vscode.commands.registerCommand(commandId, async () => {
                this.outputChannel.appendLine(`[CMD] Executing userTriggered hook: "${hook.name}"`);
                const context = {};
                const result = await this.executor.execute(hook, context);
                if (result.status === "completed") {
                    vscode.window.setStatusBarMessage(`Hook: ${hook.name}`, 3000);
                }
                else {
                    vscode.window.showWarningMessage(`Hook "${hook.name}" ${result.status}: ${result.error || ""}`);
                }
            });
            this.disposables.push(disposable);
            this.outputChannel.appendLine(`[CMD] Registered: ${commandId}`);
        }
        if (userTriggered.length > 0) {
            this.outputChannel.appendLine(`[CMD] ${userTriggered.length} userTriggered commands registered`);
        }
    }
    /**
     * Get list of registered command IDs.
     */
    async getRegisteredCommands() {
        const hooks = await (0, hook_loader_1.loadHooks)(this.workspaceRoot);
        return hooks
            .filter(h => h.when.type === "userTriggered" && h.enabled !== false)
            .map(h => `kiro-sdlc.hook.${this.sanitizeName(h.name)}`);
    }
    /**
     * Sanitize hook name to valid VS Code command segment.
     */
    sanitizeName(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
exports.HookCommands = HookCommands;
//# sourceMappingURL=hook-commands.js.map