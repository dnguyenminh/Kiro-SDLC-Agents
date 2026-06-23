"use strict";
/**
 * Core injection logic — copies resources to target workspace.
 * Delegates MCP config injection to mcp-injector module.
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
exports.injectMcpConfig = exports.migrateLegacyScripts = void 0;
exports.injectAll = injectAll;
exports.injectSelective = injectSelective;
exports.safeUpdate = safeUpdate;
exports.checkStatus = checkStatus;
exports.getVersionReport = getVersionReport;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
const checksum_1 = require("./checksum");
const file_utils_1 = require("./file-utils");
const mcp_injector_1 = require("./mcp-injector");
var mcp_injector_2 = require("./mcp-injector");
Object.defineProperty(exports, "migrateLegacyScripts", { enumerable: true, get: function () { return mcp_injector_2.migrateLegacyScripts; } });
Object.defineProperty(exports, "injectMcpConfig", { enumerable: true, get: function () { return mcp_injector_2.injectMcpConfig; } });
async function injectAll(root, extensionPath) {
    (0, checksum_1.migrateLegacyVersion)(root, extensionPath);
    const injected = [];
    for (const component of config_1.CORE_COMPONENTS) {
        if (injectComponent(component, root, extensionPath)) {
            injected.push(component.id);
        }
    }
    const variantId = await (0, mcp_injector_1.injectMcpConfig)(root);
    if (variantId) {
        injected.push(`mcp-${variantId}`);
    }
    (0, checksum_1.buildManifestAfterInject)(root, extensionPath);
    return injected;
}
async function injectSelective(root, extensionPath) {
    (0, checksum_1.migrateLegacyVersion)(root, extensionPath);
    const selected = await showComponentPicker();
    if (!selected || selected.length === 0) {
        return [];
    }
    const injected = [];
    for (const pick of selected) {
        if (pick.id === "mcp-config") {
            const variantId = await (0, mcp_injector_1.injectMcpConfig)(root);
            if (variantId) {
                injected.push(`mcp-${variantId}`);
            }
        }
        else {
            const component = config_1.CORE_COMPONENTS.find(c => c.id === pick.id);
            if (component && injectComponent(component, root, extensionPath)) {
                injected.push(component.id);
            }
        }
    }
    (0, checksum_1.buildManifestAfterInject)(root, extensionPath);
    return injected;
}
async function safeUpdate(root, extensionPath) {
    (0, checksum_1.migrateLegacyVersion)(root, extensionPath);
    const modified = (0, checksum_1.detectModifiedFiles)(root, extensionPath);
    if (modified.length === 0) {
        vscode.window.showInformationMessage("All files match bundled version. No update needed.");
        return [];
    }
    const statuses = (0, checksum_1.getFileStatuses)(root, extensionPath);
    const outdated = statuses.filter(s => s.state === "outdated");
    const userModified = statuses.filter(s => s.state === "modified");
    if (outdated.length > 0 && userModified.length === 0) {
        return forceUpdate(root, extensionPath);
    }
    const action = await promptUpdateWithDetails(outdated, userModified);
    if (action === "overwrite") {
        return forceUpdate(root, extensionPath);
    }
    if (action === "skip") {
        return updateSkipModified(root, extensionPath, userModified);
    }
    if (action === "backup") {
        return updateWithBackup(root, extensionPath, userModified);
    }
    return [];
}
function checkStatus(workspaceRoot) {
    const status = {};
    for (const c of config_1.CORE_COMPONENTS) {
        status[c.id] = fs.existsSync(path.join(workspaceRoot, c.targetPath));
    }
    status["mcp-config"] = (0, mcp_injector_1.hasMcpConfig)(workspaceRoot);
    return status;
}
/** Get per-file version report for status display. */
function getVersionReport(root, extensionPath) {
    (0, checksum_1.migrateLegacyVersion)(root, extensionPath);
    const statuses = (0, checksum_1.getFileStatuses)(root, extensionPath);
    const bundled = (0, checksum_1.loadBundledManifest)(extensionPath);
    const bundledVersion = bundled?.version || "unknown";
    const outdated = statuses.filter(s => s.state === "outdated");
    const modified = statuses.filter(s => s.state === "modified");
    const missing = statuses.filter(s => s.state === "missing");
    const current = statuses.filter(s => s.state === "current");
    const lines = [
        `Extension version: ${bundledVersion}`,
        `Files: ${current.length} current, ${outdated.length} outdated, ${modified.length} modified, ${missing.length} missing`
    ];
    if (outdated.length > 0) {
        lines.push("\n⬆️ Outdated (need update):");
        for (const f of outdated.slice(0, 15)) {
            lines.push(`  ${f.relativePath}  [v${f.workspaceVersion} → v${f.bundledVersion}]`);
        }
        if (outdated.length > 15) {
            lines.push(`  ...and ${outdated.length - 15} more`);
        }
    }
    if (modified.length > 0) {
        lines.push("\n✏️ Modified by user:");
        for (const f of modified.slice(0, 10)) {
            lines.push(`  ${f.relativePath}  [v${f.workspaceVersion}]`);
        }
        if (modified.length > 10) {
            lines.push(`  ...and ${modified.length - 10} more`);
        }
    }
    return lines.join("\n");
}
function forceUpdate(root, extensionPath) {
    const injected = [];
    for (const component of config_1.CORE_COMPONENTS) {
        if (injectComponent(component, root, extensionPath)) {
            injected.push(component.id);
        }
    }
    (0, checksum_1.buildManifestAfterInject)(root, extensionPath);
    return injected;
}
function updateSkipModified(root, extensionPath, userModified) {
    const skipPaths = new Set(userModified.map(m => m.relativePath));
    const injected = [];
    for (const component of config_1.CORE_COMPONENTS) {
        if (injectComponentFiltered(component, root, extensionPath, skipPaths)) {
            injected.push(component.id);
        }
    }
    (0, checksum_1.buildManifestAfterInject)(root, extensionPath);
    return injected;
}
function updateWithBackup(root, extensionPath, userModified) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(root, ".kiro/.sdlc-backup", timestamp);
    for (const file of userModified) {
        const src = path.join(root, file.relativePath);
        const dest = path.join(backupDir, file.relativePath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
        }
    }
    vscode.window.showInformationMessage(`Backed up ${userModified.length} files to .kiro/.sdlc-backup/${timestamp}`);
    return forceUpdate(root, extensionPath);
}
async function promptUpdateWithDetails(outdated, userModified) {
    const lines = [];
    if (outdated.length > 0) {
        lines.push(`⬆️ ${outdated.length} file(s) outdated`);
        outdated.slice(0, 5).forEach(f => lines.push(`  • ${f.relativePath}`));
    }
    if (userModified.length > 0) {
        lines.push(`✏️ ${userModified.length} file(s) modified by you`);
        userModified.slice(0, 5).forEach(f => lines.push(`  • ${f.relativePath}`));
    }
    const action = await vscode.window.showWarningMessage(lines.join("\n"), { modal: true }, "Overwrite All", "Skip Modified", "Backup & Overwrite", "Cancel");
    if (action === "Overwrite All") {
        return "overwrite";
    }
    if (action === "Skip Modified") {
        return "skip";
    }
    if (action === "Backup & Overwrite") {
        return "backup";
    }
    return "cancel";
}
async function showComponentPicker() {
    const corePicks = config_1.CORE_COMPONENTS.map(c => ({
        label: c.label, description: c.description, id: c.id, picked: true
    }));
    const mcpPick = {
        label: "Code Intelligence MCP Server (choose variant next)",
        description: "MCP server config — replaces legacy indexer scripts",
        id: "mcp-config", picked: true
    };
    return vscode.window.showQuickPick([...corePicks, mcpPick], {
        canPickMany: true, placeHolder: "Select components to inject"
    });
}
function injectComponent(component, root, extensionPath) {
    const source = path.join(extensionPath, "resources", component.sourcePath);
    const target = path.join(root, component.targetPath);
    if (!fs.existsSync(source)) {
        vscode.window.showWarningMessage(`Source not found: ${component.sourcePath}`);
        return false;
    }
    try {
        if (component.filter) {
            (0, file_utils_1.copySelectedItems)(source, target, component.filter);
        }
        else {
            (0, file_utils_1.copyDirRecursive)(source, target);
        }
        return true;
    }
    catch (err) {
        vscode.window.showErrorMessage(`Failed to inject ${component.id}: ${err}`);
        return false;
    }
}
function injectComponentFiltered(component, root, extensionPath, skipPaths) {
    const source = path.join(extensionPath, "resources", component.sourcePath);
    const target = path.join(root, component.targetPath);
    if (!fs.existsSync(source)) {
        return false;
    }
    try {
        (0, file_utils_1.copyDirFiltered)({ source, target, workspaceRoot: root, skipPaths });
        return true;
    }
    catch (err) {
        vscode.window.showErrorMessage(`Failed to inject ${component.id}: ${err}`);
        return false;
    }
}
//# sourceMappingURL=injector.js.map