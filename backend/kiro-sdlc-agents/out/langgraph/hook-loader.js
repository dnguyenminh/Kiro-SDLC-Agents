"use strict";
/**
 * HookLoader — KSA-242
 * Reads .kiro/hooks/*.json and *.kiro.hook files at runtime,
 * parses hook definitions, and provides trigger methods for LangGraph nodes.
 *
 * This replicates Kiro IDE hook behavior inside the LangGraph pipeline,
 * ensuring hooks fire even when running outside IDE context.
 *
 * Supported hook types:
 * - preToolUse: fires before MCP tool calls (e.g., validate drawio before write)
 * - postToolUse: fires after MCP tool calls
 * - agentStop: fires after node completes (e.g., log to KB)
 * - promptSubmit: fires when pipeline receives new input
 * - fileEdited/fileCreated: fires after file write operations
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
exports.validateHookSchema = validateHookSchema;
exports.loadHooks = loadHooks;
exports.clearHookCache = clearHookCache;
exports.filterHooksByType = filterHooksByType;
exports.filterPreToolUseHooks = filterPreToolUseHooks;
exports.filterFileHooks = filterFileHooks;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
// === Schema Validation (KSA-249) ===
const VALID_EVENT_TYPES = [
    "promptSubmit", "agentStop", "preToolUse", "postToolUse",
    "fileEdited", "fileCreated", "fileDeleted", "userTriggered",
    "preTaskExecution", "postTaskExecution",
];
const VALID_ACTION_TYPES = ["askAgent", "runCommand"];
/**
 * Validate a parsed hook object against the schema.
 * Returns array of errors (empty = valid).
 */
function validateHookSchema(parsed, fileName) {
    const errors = [];
    const obj = parsed;
    if (!obj || typeof obj !== "object") {
        errors.push({ file: fileName, field: "root", message: "Hook must be a JSON object" });
        return errors;
    }
    if (!obj.name || typeof obj.name !== "string" || obj.name.trim().length === 0) {
        errors.push({ file: fileName, field: "name", message: "Required non-empty string" });
    }
    if (!obj.version || typeof obj.version !== "string") {
        errors.push({ file: fileName, field: "version", message: "Required non-empty string" });
    }
    if (!obj.when || typeof obj.when !== "object") {
        errors.push({ file: fileName, field: "when", message: "Required object" });
    }
    else {
        const when = obj.when;
        if (!when.type || !VALID_EVENT_TYPES.includes(when.type)) {
            errors.push({
                file: fileName,
                field: "when.type",
                message: `Must be one of: ${VALID_EVENT_TYPES.join(", ")}`,
            });
        }
    }
    if (!obj.then || typeof obj.then !== "object") {
        errors.push({ file: fileName, field: "then", message: "Required object" });
    }
    else {
        const then = obj.then;
        if (!then.type || !VALID_ACTION_TYPES.includes(then.type)) {
            errors.push({
                file: fileName,
                field: "then.type",
                message: `Must be one of: ${VALID_ACTION_TYPES.join(", ")}`,
            });
        }
        else if (then.type === "askAgent" && (!then.prompt || typeof then.prompt !== "string")) {
            errors.push({ file: fileName, field: "then.prompt", message: "Required for askAgent action" });
        }
        else if (then.type === "runCommand" && (!then.command || typeof then.command !== "string")) {
            errors.push({ file: fileName, field: "then.command", message: "Required for runCommand action" });
        }
    }
    return errors;
}
/** Cached hooks — loaded once per pipeline execution */
let cachedHooks = null;
/** Output channel for hook system logging */
let hookOutputChannel;
function getHookOutputChannel() {
    if (!hookOutputChannel) {
        hookOutputChannel = vscode.window.createOutputChannel("Kiro SDLC Hooks");
    }
    return hookOutputChannel;
}
/**
 * Load all hook definitions from .kiro/hooks/ directory.
 * Validates schema — invalid hooks are skipped with logged errors.
 * Caches result for duration of pipeline execution.
 */
async function loadHooks(workspaceRoot, forceReload = false) {
    if (cachedHooks && !forceReload)
        return cachedHooks;
    const hooksDir = path.join(workspaceRoot, ".kiro", "hooks");
    const hooks = [];
    const channel = getHookOutputChannel();
    try {
        const dirUri = vscode.Uri.file(hooksDir);
        const entries = await vscode.workspace.fs.readDirectory(dirUri);
        for (const [name, type] of entries) {
            if (type !== vscode.FileType.File)
                continue;
            if (!name.endsWith(".json") && !name.endsWith(".kiro.hook"))
                continue;
            try {
                const filePath = path.join(hooksDir, name);
                const uri = vscode.Uri.file(filePath);
                const bytes = await vscode.workspace.fs.readFile(uri);
                const content = Buffer.from(bytes).toString("utf-8");
                const parsed = JSON.parse(content);
                const validationErrors = validateHookSchema(parsed, name);
                if (validationErrors.length > 0) {
                    for (const err of validationErrors) {
                        channel.appendLine(`[WARN] ${err.file}: ${err.field} — ${err.message}`);
                    }
                    continue;
                }
                const hook = {
                    name: parsed.name,
                    version: parsed.version,
                    description: parsed.description,
                    enabled: parsed.enabled !== false,
                    when: parsed.when,
                    then: parsed.then,
                    filePath: `.kiro/hooks/${name}`,
                };
                if (hook.enabled) {
                    hooks.push(hook);
                }
            }
            catch (err) {
                channel.appendLine(`[ERROR] Failed to parse ${name}: ${err.message}`);
            }
        }
    }
    catch {
        // Hooks directory doesn't exist — not an error
    }
    channel.appendLine(`[INFO] Loaded ${hooks.length} valid hooks`);
    cachedHooks = hooks;
    return hooks;
}
/**
 * Clear cached hooks (call when reloading is needed).
 */
function clearHookCache() {
    cachedHooks = null;
}
/**
 * Get hooks matching a specific event type.
 */
function filterHooksByType(hooks, eventType) {
    return hooks.filter(h => h.when.type === eventType);
}
/**
 * Get hooks matching preToolUse with specific tool type category.
 * Tool types can be: "read", "write", "shell", "web", "spec", "*"
 * or regex patterns for MCP tool names.
 */
function filterPreToolUseHooks(hooks, toolCategory) {
    return hooks.filter(h => {
        if (h.when.type !== "preToolUse")
            return false;
        if (!h.when.toolTypes)
            return false;
        return h.when.toolTypes.some(pattern => {
            if (pattern === "*")
                return true;
            if (pattern === toolCategory)
                return true;
            // Try regex match
            try {
                return new RegExp(pattern).test(toolCategory);
            }
            catch {
                return false;
            }
        });
    });
}
/**
 * Get hooks matching fileEdited/fileCreated with file pattern matching.
 */
function filterFileHooks(hooks, eventType, filePath) {
    return hooks.filter(h => {
        if (h.when.type !== eventType)
            return false;
        if (!h.when.patterns)
            return true; // no pattern = match all
        return h.when.patterns.some(pattern => {
            return matchGlob(pattern, filePath);
        });
    });
}
/**
 * Simple glob matching (supports * and **).
 */
function matchGlob(pattern, filePath) {
    // Convert glob to regex
    const regex = pattern
        .replace(/\./g, "\\.")
        .replace(/\*\*/g, "<<<GLOBSTAR>>>")
        .replace(/\*/g, "[^/]*")
        .replace(/<<<GLOBSTAR>>>/g, ".*");
    try {
        return new RegExp(`^${regex}$`).test(filePath) ||
            new RegExp(regex).test(filePath);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=hook-loader.js.map