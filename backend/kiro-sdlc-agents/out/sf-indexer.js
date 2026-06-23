"use strict";
/**
 * Salesforce project indexing — "Kiro SDLC: Index Salesforce Project" command.
 * v2: Delegates to the code-intelligence MCP server's git_index tool which
 * auto-detects SFDX projects. Provides SF-specific progress and result messages.
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
exports.handleIndexSalesforceProject = handleIndexSalesforceProject;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let indexingInProgress = false;
/**
 * Command handler for "kiroSdlc.indexSalesforceProject".
 * Detects SFDX project, then triggers the workspace indexer (code-intelligence
 * server already handles Apex, Flows, Objects, LWC, etc.).
 */
async function handleIndexSalesforceProject() {
    if (indexingInProgress) {
        vscode.window.showInformationMessage("Salesforce indexing already in progress");
        return;
    }
    const root = getWorkspaceRoot();
    if (!root) {
        return;
    }
    const sfdxRoot = detectSfdxProject(root);
    if (!sfdxRoot) {
        vscode.window.showErrorMessage("No SFDX project found in workspace (missing sfdx-project.json)");
        return;
    }
    indexingInProgress = true;
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Indexing Salesforce project...",
            cancellable: false,
        }, async (progress) => {
            progress.report({ message: "Scanning SFDX metadata..." });
            // Count SF metadata files before indexing for result reporting
            const sfCounts = countSalesforceMetadata(sfdxRoot);
            progress.report({ message: `Found ${sfCounts.total} SF components. Indexing...` });
            // Delegate to the existing workspace indexer command which uses
            // the code-intelligence MCP server (git_index auto-detects SFDX)
            await vscode.commands.executeCommand("kiroSdlc.indexWorkspace");
            // Show SF-specific result summary
            const parts = [];
            if (sfCounts.apexClasses > 0) {
                parts.push(`${sfCounts.apexClasses} Apex classes`);
            }
            if (sfCounts.flows > 0) {
                parts.push(`${sfCounts.flows} Flows`);
            }
            if (sfCounts.objects > 0) {
                parts.push(`${sfCounts.objects} Objects`);
            }
            if (sfCounts.lwc > 0) {
                parts.push(`${sfCounts.lwc} LWC components`);
            }
            if (sfCounts.triggers > 0) {
                parts.push(`${sfCounts.triggers} Triggers`);
            }
            const summary = parts.length > 0
                ? parts.join(", ")
                : `${sfCounts.total} metadata files`;
            vscode.window.showInformationMessage(`✅ Salesforce project indexed: ${summary}`);
        });
    }
    catch (err) {
        vscode.window.showErrorMessage(`❌ Salesforce indexing error: ${err.message}`);
    }
    finally {
        indexingInProgress = false;
    }
}
/**
 * Detect SFDX project root by looking for sfdx-project.json.
 * Checks workspace root first, then immediate subdirectories.
 */
function detectSfdxProject(root) {
    if (fs.existsSync(path.join(root, "sfdx-project.json"))) {
        return root;
    }
    try {
        const dirs = fs.readdirSync(root, { withFileTypes: true })
            .filter(d => d.isDirectory() && !d.name.startsWith("."));
        for (const dir of dirs) {
            const dirPath = path.join(root, dir.name);
            if (fs.existsSync(path.join(dirPath, "sfdx-project.json"))) {
                return dirPath;
            }
        }
    }
    catch { /* ignore */ }
    return null;
}
/**
 * Count Salesforce metadata files by category for result reporting.
 */
function countSalesforceMetadata(sfdxRoot) {
    const result = { apexClasses: 0, flows: 0, objects: 0, lwc: 0, triggers: 0, total: 0 };
    const walkDir = (dir, ext) => {
        if (!fs.existsSync(dir)) {
            return 0;
        }
        try {
            return countFilesRecursive(dir, ext);
        }
        catch {
            return 0;
        }
    };
    // Standard SFDX source paths
    const forcePath = path.join(sfdxRoot, "force-app", "main", "default");
    const altPath = path.join(sfdxRoot, "src"); // legacy MDAPI format
    const basePath = fs.existsSync(forcePath) ? forcePath : altPath;
    if (!fs.existsSync(basePath)) {
        return result;
    }
    result.apexClasses = walkDir(path.join(basePath, "classes"), ".cls");
    result.triggers = walkDir(path.join(basePath, "triggers"), ".trigger");
    result.flows = walkDir(path.join(basePath, "flows"), ".flow-meta.xml")
        + walkDir(path.join(basePath, "flowDefinitions"), ".flowDefinition-meta.xml");
    result.objects = walkDir(path.join(basePath, "objects"), ".object-meta.xml")
        + countFilesRecursive(path.join(basePath, "objects"), ".field-meta.xml");
    result.lwc = countDirectories(path.join(basePath, "lwc"));
    result.total = result.apexClasses + result.triggers + result.flows + result.objects + result.lwc;
    return result;
}
/** Recursively count files matching an extension. */
function countFilesRecursive(dir, ext) {
    if (!fs.existsSync(dir)) {
        return 0;
    }
    let count = 0;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                count += countFilesRecursive(fullPath, ext);
            }
            else if (entry.name.endsWith(ext)) {
                count++;
            }
        }
    }
    catch { /* permission errors, etc. */ }
    return count;
}
/** Count immediate subdirectories (for LWC components). */
function countDirectories(dir) {
    if (!fs.existsSync(dir)) {
        return 0;
    }
    try {
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter(d => d.isDirectory() && !d.name.startsWith("."))
            .length;
    }
    catch {
        return 0;
    }
}
function getWorkspaceRoot() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder open.");
        return undefined;
    }
    return folders[0].uri.fsPath;
}
//# sourceMappingURL=sf-indexer.js.map