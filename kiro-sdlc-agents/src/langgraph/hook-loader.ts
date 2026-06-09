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

import * as vscode from "vscode";
import * as path from "path";

export interface HookDefinition {
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  when: HookTrigger;
  then: HookAction;
  filePath: string; // source file for debugging
}

export interface HookTrigger {
  type: "promptSubmit" | "agentStop" | "preToolUse" | "postToolUse"
    | "fileEdited" | "fileCreated" | "fileDeleted" | "userTriggered"
    | "preTaskExecution" | "postTaskExecution";
  patterns?: string[];
  toolTypes?: string[];
}

export interface HookAction {
  type: "askAgent" | "runCommand";
  prompt?: string;  // for askAgent
  command?: string; // for runCommand
}

// === Schema Validation (KSA-249) ===

const VALID_EVENT_TYPES: HookTrigger["type"][] = [
  "promptSubmit", "agentStop", "preToolUse", "postToolUse",
  "fileEdited", "fileCreated", "fileDeleted", "userTriggered",
  "preTaskExecution", "postTaskExecution",
];

const VALID_ACTION_TYPES: HookAction["type"][] = ["askAgent", "runCommand"];

export interface HookValidationError {
  file: string;
  field: string;
  message: string;
}

/**
 * Validate a parsed hook object against the schema.
 * Returns array of errors (empty = valid).
 */
export function validateHookSchema(parsed: unknown, fileName: string): HookValidationError[] {
  const errors: HookValidationError[] = [];
  const obj = parsed as Record<string, unknown>;

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
  } else {
    const when = obj.when as Record<string, unknown>;
    if (!when.type || !VALID_EVENT_TYPES.includes(when.type as HookTrigger["type"])) {
      errors.push({
        file: fileName,
        field: "when.type",
        message: `Must be one of: ${VALID_EVENT_TYPES.join(", ")}`,
      });
    }
  }

  if (!obj.then || typeof obj.then !== "object") {
    errors.push({ file: fileName, field: "then", message: "Required object" });
  } else {
    const then = obj.then as Record<string, unknown>;
    if (!then.type || !VALID_ACTION_TYPES.includes(then.type as HookAction["type"])) {
      errors.push({
        file: fileName,
        field: "then.type",
        message: `Must be one of: ${VALID_ACTION_TYPES.join(", ")}`,
      });
    } else if (then.type === "askAgent" && (!then.prompt || typeof then.prompt !== "string")) {
      errors.push({ file: fileName, field: "then.prompt", message: "Required for askAgent action" });
    } else if (then.type === "runCommand" && (!then.command || typeof then.command !== "string")) {
      errors.push({ file: fileName, field: "then.command", message: "Required for runCommand action" });
    }
  }

  return errors;
}

/** Cached hooks — loaded once per pipeline execution */
let cachedHooks: HookDefinition[] | null = null;

/** Output channel for hook system logging */
let hookOutputChannel: vscode.OutputChannel | undefined;

function getHookOutputChannel(): vscode.OutputChannel {
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
export async function loadHooks(workspaceRoot: string, forceReload = false): Promise<HookDefinition[]> {
  if (cachedHooks && !forceReload) return cachedHooks;

  const hooksDir = path.join(workspaceRoot, ".kiro", "hooks");
  const hooks: HookDefinition[] = [];
  const channel = getHookOutputChannel();

  try {
    const dirUri = vscode.Uri.file(hooksDir);
    const entries = await vscode.workspace.fs.readDirectory(dirUri);

    for (const [name, type] of entries) {
      if (type !== vscode.FileType.File) continue;
      if (!name.endsWith(".json") && !name.endsWith(".kiro.hook")) continue;

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

        const hook: HookDefinition = {
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
      } catch (err) {
        channel.appendLine(`[ERROR] Failed to parse ${name}: ${(err as Error).message}`);
      }
    }
  } catch {
    // Hooks directory doesn't exist — not an error
  }

  channel.appendLine(`[INFO] Loaded ${hooks.length} valid hooks`);
  cachedHooks = hooks;
  return hooks;
}

/**
 * Clear cached hooks (call when reloading is needed).
 */
export function clearHookCache(): void {
  cachedHooks = null;
}

/**
 * Get hooks matching a specific event type.
 */
export function filterHooksByType(hooks: HookDefinition[], eventType: string): HookDefinition[] {
  return hooks.filter(h => h.when.type === eventType);
}

/**
 * Get hooks matching preToolUse with specific tool type category.
 * Tool types can be: "read", "write", "shell", "web", "spec", "*"
 * or regex patterns for MCP tool names.
 */
export function filterPreToolUseHooks(hooks: HookDefinition[], toolCategory: string): HookDefinition[] {
  return hooks.filter(h => {
    if (h.when.type !== "preToolUse") return false;
    if (!h.when.toolTypes) return false;

    return h.when.toolTypes.some(pattern => {
      if (pattern === "*") return true;
      if (pattern === toolCategory) return true;
      // Try regex match
      try {
        return new RegExp(pattern).test(toolCategory);
      } catch {
        return false;
      }
    });
  });
}

/**
 * Get hooks matching fileEdited/fileCreated with file pattern matching.
 */
export function filterFileHooks(
  hooks: HookDefinition[],
  eventType: "fileEdited" | "fileCreated" | "fileDeleted",
  filePath: string
): HookDefinition[] {
  return hooks.filter(h => {
    if (h.when.type !== eventType) return false;
    if (!h.when.patterns) return true; // no pattern = match all

    return h.when.patterns.some(pattern => {
      return matchGlob(pattern, filePath);
    });
  });
}

/**
 * Simple glob matching (supports * and **).
 */
function matchGlob(pattern: string, filePath: string): boolean {
  // Convert glob to regex
  const regex = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR>>>/g, ".*");

  try {
    return new RegExp(`^${regex}$`).test(filePath) ||
      new RegExp(regex).test(filePath);
  } catch {
    return false;
  }
}
