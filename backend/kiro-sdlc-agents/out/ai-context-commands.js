"use strict";
/**
 * AI Context Commands — KSA-177
 * Commands to get AI context for symbol at cursor and copy to clipboard.
 * Commands: kiroSdlc.getAIContext, kiroSdlc.getEditContext
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
exports.registerAIContextCommands = registerAIContextCommands;
const vscode = __importStar(require("vscode"));
/**
 * Register AI context commands.
 */
function registerAIContextCommands(context, mcpManager) {
    context.subscriptions.push(vscode.commands.registerCommand("kiroSdlc.getAIContext", () => getContextForCursor(mcpManager, "get_ai_context")), vscode.commands.registerCommand("kiroSdlc.getEditContext", () => getContextForCursor(mcpManager, "get_edit_context")));
}
async function getContextForCursor(mcpManager, toolName) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage("No active editor. Open a file first.");
        return;
    }
    const symbol = getSymbolAtCursor(editor);
    const file = vscode.workspace.asRelativePath(editor.document.uri);
    const line = editor.selection.active.line + 1;
    if (!symbol) {
        vscode.window.showWarningMessage("No symbol found at cursor position.");
        return;
    }
    try {
        const raw = await mcpManager.invokeTool(toolName, { symbol, file, line });
        const contextText = formatContext(raw, symbol, toolName);
        await vscode.env.clipboard.writeText(contextText);
        vscode.window.showInformationMessage(`Context for "${symbol}" copied to clipboard.`);
    }
    catch (err) {
        vscode.window.showErrorMessage(`Failed to get context: ${err.message}`);
    }
}
function getSymbolAtCursor(editor) {
    const position = editor.selection.active;
    const wordRange = editor.document.getWordRangeAtPosition(position);
    if (!wordRange) {
        return undefined;
    }
    return editor.document.getText(wordRange);
}
function formatContext(raw, symbol, toolName) {
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "string") {
            return parsed;
        }
        const sections = [];
        const label = toolName === "get_ai_context" ? "AI" : "Edit";
        sections.push(`# ${label} Context: ${symbol}\n`);
        if (parsed.definition) {
            sections.push(`## Definition\n\`\`\`\n${parsed.definition}\n\`\`\`\n`);
        }
        if (parsed.documentation) {
            sections.push(`## Documentation\n${parsed.documentation}\n`);
        }
        if (parsed.usages && parsed.usages.length > 0) {
            sections.push(`## Usages (${parsed.usages.length})`);
            for (const usage of parsed.usages.slice(0, 10)) {
                sections.push(`- ${usage.file}:${usage.line} — ${usage.context || ""}`);
            }
            sections.push("");
        }
        if (parsed.relatedSymbols && parsed.relatedSymbols.length > 0) {
            sections.push(`## Related Symbols`);
            for (const rel of parsed.relatedSymbols.slice(0, 10)) {
                sections.push(`- ${rel.name} (${rel.kind}) — ${rel.file || ""}`);
            }
            sections.push("");
        }
        if (parsed.context) {
            sections.push(`## Context\n${parsed.context}\n`);
        }
        return sections.join("\n") || raw;
    }
    catch {
        return raw;
    }
}
//# sourceMappingURL=ai-context-commands.js.map