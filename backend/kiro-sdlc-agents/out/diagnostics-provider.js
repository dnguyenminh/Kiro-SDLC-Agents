"use strict";
/**
 * DiagnosticsProvider — KSA-178
 * On file save → queries code_search for issues → shows as VS Code diagnostics.
 * Also provides CodeActions for quick fixes.
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
exports.registerDiagnosticsProvider = registerDiagnosticsProvider;
const vscode = __importStar(require("vscode"));
const DIAGNOSTIC_SOURCE = "Kiro Code Intelligence";
/**
 * Register the diagnostics provider. Auto-triggers on file save.
 */
function registerDiagnosticsProvider(context, mcpManager) {
    const diagnostics = vscode.languages.createDiagnosticCollection("kiroCodeIntel");
    context.subscriptions.push(diagnostics);
    // Analyze on save
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc) => {
        analyzeDocument(doc, mcpManager, diagnostics);
    }));
    // Register code action provider for all languages
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider({ scheme: "file" }, new KiroCodeActionProvider(diagnostics), { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }));
    // Clear diagnostics when file is closed
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
        diagnostics.delete(doc.uri);
    }));
    return diagnostics;
}
async function analyzeDocument(doc, mcpManager, diagnostics) {
    if (mcpManager.status !== "running") {
        return;
    }
    const relativePath = vscode.workspace.asRelativePath(doc.uri);
    try {
        const raw = await mcpManager.invokeTool("code_search", {
            query: `issues in ${relativePath}`,
            file: relativePath,
            limit: 50,
        });
        const issues = parseIssues(raw, doc);
        diagnostics.set(doc.uri, issues);
    }
    catch {
        // Silently fail — don't disrupt user workflow
    }
}
function parseIssues(raw, doc) {
    try {
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : (parsed.issues || parsed.results || []);
        return items.map((issue) => toDiagnostic(issue, doc)).filter(Boolean);
    }
    catch {
        return [];
    }
}
function toDiagnostic(issue, doc) {
    const line = Math.max(0, (issue.line || 1) - 1);
    const col = Math.max(0, (issue.column || 1) - 1);
    const endLine = Math.max(line, (issue.endLine || issue.line || 1) - 1);
    const endCol = issue.endColumn ? issue.endColumn - 1 : doc.lineAt(endLine).text.length;
    const range = new vscode.Range(line, col, endLine, endCol);
    const severity = mapSeverity(issue.severity);
    const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
    diagnostic.source = DIAGNOSTIC_SOURCE;
    diagnostic.code = issue.code || "kiro-issue";
    if (issue.suggestion) {
        diagnostic.relatedInformation = [
            new vscode.DiagnosticRelatedInformation(new vscode.Location(doc.uri, range), `Fix: ${issue.suggestion}`),
        ];
    }
    return diagnostic;
}
function mapSeverity(severity) {
    switch (severity) {
        case "error": return vscode.DiagnosticSeverity.Error;
        case "warning": return vscode.DiagnosticSeverity.Warning;
        case "hint": return vscode.DiagnosticSeverity.Hint;
        default: return vscode.DiagnosticSeverity.Information;
    }
}
class KiroCodeActionProvider {
    diagnostics;
    constructor(diagnostics) {
        this.diagnostics = diagnostics;
    }
    provideCodeActions(document, range, context) {
        const actions = [];
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== DIAGNOSTIC_SOURCE) {
                continue;
            }
            if (!diagnostic.relatedInformation?.length) {
                continue;
            }
            const suggestion = diagnostic.relatedInformation[0].message.replace("Fix: ", "");
            const action = new vscode.CodeAction(`Fix: ${suggestion}`, vscode.CodeActionKind.QuickFix);
            action.diagnostics = [diagnostic];
            action.isPreferred = true;
            actions.push(action);
        }
        return actions;
    }
}
//# sourceMappingURL=diagnostics-provider.js.map