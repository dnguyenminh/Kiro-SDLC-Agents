"use strict";
/**
 * Symbol Search QuickPick — KSA-179
 * Provides a debounced symbol search via MCP code_search/code_symbols tools.
 * User types → debounced search → shows results with file:line → navigate on select.
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
exports.registerSymbolSearch = registerSymbolSearch;
const vscode = __importStar(require("vscode"));
const DEBOUNCE_MS = 300;
/**
 * Register the symbolSearch command.
 */
function registerSymbolSearch(context, mcpManager) {
    context.subscriptions.push(vscode.commands.registerCommand("kiroSdlc.symbolSearch", () => showSymbolSearchPick(mcpManager)));
}
async function showSymbolSearchPick(mcpManager) {
    const quickPick = vscode.window.createQuickPick();
    quickPick.placeholder = "Search symbols (classes, functions, interfaces)...";
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;
    let debounceTimer;
    quickPick.onDidChangeValue((value) => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        if (!value || value.length < 2) {
            quickPick.items = [];
            return;
        }
        quickPick.busy = true;
        debounceTimer = setTimeout(() => performSearch(quickPick, mcpManager, value), DEBOUNCE_MS);
    });
    quickPick.onDidAccept(() => {
        const selected = quickPick.selectedItems[0];
        if (selected) {
            navigateToSymbol(selected);
        }
        quickPick.dispose();
    });
    quickPick.onDidHide(() => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        quickPick.dispose();
    });
    quickPick.show();
}
async function performSearch(quickPick, mcpManager, query) {
    try {
        const raw = await mcpManager.invokeTool("code_search", { query, limit: 20 });
        const results = parseResults(raw);
        quickPick.items = results.map(toQuickPickItem);
    }
    catch {
        quickPick.items = [{ label: "$(error) Search failed", description: "MCP server may be unavailable", result: undefined }];
    }
    finally {
        quickPick.busy = false;
    }
}
function parseResults(raw) {
    try {
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : (parsed.results || parsed.symbols || []);
        return items.map((item) => ({
            name: item.name || item.symbol || "unknown",
            kind: item.kind || item.type || "symbol",
            file: item.file || item.path || "",
            line: item.line || item.startLine || 1,
        }));
    }
    catch {
        return [];
    }
}
function toQuickPickItem(result) {
    const icon = getKindIcon(result.kind);
    return {
        label: `${icon} ${result.name}`,
        description: `${result.file}:${result.line}`,
        detail: result.kind,
        result,
    };
}
function getKindIcon(kind) {
    const icons = {
        class: "$(symbol-class)",
        function: "$(symbol-method)",
        interface: "$(symbol-interface)",
        enum: "$(symbol-enum)",
        variable: "$(symbol-variable)",
        namespace: "$(symbol-namespace)",
    };
    return icons[kind.toLowerCase()] || "$(symbol-misc)";
}
async function navigateToSymbol(item) {
    if (!item.result) {
        return;
    }
    const { file, line } = item.result;
    try {
        const uri = vscode.Uri.file(file);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);
        const pos = new vscode.Position(Math.max(0, line - 1), 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    }
    catch {
        vscode.window.showErrorMessage(`Cannot open file: ${file}`);
    }
}
//# sourceMappingURL=symbol-search.js.map