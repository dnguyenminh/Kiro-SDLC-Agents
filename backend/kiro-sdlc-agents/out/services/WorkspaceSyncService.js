"use strict";
/**
 * WorkspaceSyncService — Syncs file tree metadata to remote backend.
 * Sends relative paths only (no file content, no absolute paths).
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
exports.WorkspaceSyncService = void 0;
const vscode = __importStar(require("vscode"));
class WorkspaceSyncService {
    httpClient;
    watcher;
    constructor(httpClient) {
        this.httpClient = httpClient;
    }
    /**
     * Start watching for workspace folder changes.
     */
    startWatching() {
        this.watcher = vscode.workspace.onDidChangeWorkspaceFolders(() => this.sync());
    }
    /**
     * Sync the file tree to the backend.
     */
    async sync() {
        const files = await vscode.workspace.findFiles("**/*", "{node_modules,dist,.git,build,out,.code-intel}/**");
        const tree = {
            workspace_name: vscode.workspace.name || "unknown",
            files: await Promise.all(files.slice(0, 10000).map(async (f) => {
                const stat = await vscode.workspace.fs.stat(f);
                return {
                    path: vscode.workspace.asRelativePath(f),
                    type: "file",
                    size: stat.size,
                };
            })),
        };
        await this.httpClient.post("/api/workspace/sync", tree, 30000);
    }
    dispose() {
        this.watcher?.dispose();
    }
}
exports.WorkspaceSyncService = WorkspaceSyncService;
//# sourceMappingURL=WorkspaceSyncService.js.map