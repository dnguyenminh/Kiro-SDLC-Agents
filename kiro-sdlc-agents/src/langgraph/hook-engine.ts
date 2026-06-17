/**
 * HookEngine — KSA-280
 * Unified hook engine for the Chat Panel LangGraph pipeline.
 * Integrates hook loading, matching, execution, and UI emission into a single
 * class used by chat-graph.ts and message-handler.ts.
 *
 * Responsibilities:
 * - Reads all .kiro/hooks/*.kiro.hook and *.json files on initialization
 * - Fires hooks at correct checkpoints (preToolUse, postToolUse, promptSubmit, agentStop)
 * - Executes actions (askAgent → append prompt; runCommand → child_process with timeout)
 * - Emits hook firing as action blocks via StreamHandler
 * - Guards: circular hook prevention, timeout enforcement, error isolation
 */

import { debugLog, debugError } from "../debug-logger";
import { StreamHandler } from "./stream-handler";
import {
  HookDefinition,
  loadHooks,
  clearHookCache,
  filterHooksByType,
} from "./hook-loader";
import { HookExecutor, HookContext, HookResult } from "./hook-executor";
import * as vscode from "vscode";

/** Tool category classification — matches HookEventsManager pattern */
const TOOL_CATEGORIES: Record<string, string> = {
  // Read tools
  readFile: "read",
  read_file: "read",
  read_code: "read",
  read_files: "read",
  grep_search: "read",
  file_search: "read",
  list_directory: "read",
  get_diagnostics: "read",
  get_process_output: "read",
  // Write tools
  fs_write: "write",
  str_replace: "write",
  fs_append: "write",
  delete_file: "write",
  stream_write_file: "write",
  // Shell tools
  execute_pwsh: "shell",
  control_pwsh_process: "shell",
  // Web tools
  web_search: "web",
  fetch_url: "web",
};

/** Result of a preToolUse hook — may deny execution or inject prompt */
export interface PreToolUseHookResult {
  denied: boolean;
  hookName?: string;
  reason?: string;
  injectedPrompts: string[];
}

/** Result of a postToolUse hook — collected prompts to inject */
export interface PostToolUseHookResult {
  injectedPrompts: string[];
}

export class HookEngine {
  private hooks: HookDefinition[] = [];
  private loaded = false;
  private executionStack: Set<string> = new Set();
  private executor: HookExecutor;
  private outputChannel: vscode.OutputChannel;
  private readonly DEFAULT_TIMEOUT = 60_000;

  constructor(private readonly workspaceRoot: string) {
    this.outputChannel = vscode.window.createOutputChannel("Kiro Hooks Engine");
    this.executor = new HookExecutor(this.outputChannel, this.DEFAULT_TIMEOUT);
  }

  /**
   * Initialize: load all hooks from .kiro/hooks/ directory.
   * Safe to call multiple times (cached after first load).
   */
  async initialize(): Promise<void> {
    if (this.loaded) return;
    try {
      this.hooks = await loadHooks(this.workspaceRoot);
      this.loaded = true;
      debugLog(`[HookEngine] Initialized with ${this.hooks.length} hooks`);
    } catch (err) {
      debugError("[HookEngine] Failed to load hooks", err as Error);
      this.hooks = [];
      this.loaded = true;
    }
  }

  /**
   * Force reload hooks (e.g., after hook file changes).
   */
  async reload(): Promise<void> {
    clearHookCache();
    this.loaded = false;
    await this.initialize();
  }

  /**
   * Fire preToolUse hooks before a tool is executed.
   * Returns denial info if any hook denies, plus any askAgent prompts to inject.
   */
  async firePreToolUse(
    toolName: string,
    args: Record<string, unknown>,
    streamHandler: StreamHandler,
    streamId: string
  ): Promise<PreToolUseHookResult> {
    await this.initialize();

    const category = this.classifyTool(toolName);
    const matching = this.getMatchingToolHooks("preToolUse", toolName, category);

    if (matching.length === 0) {
      return { denied: false, injectedPrompts: [] };
    }

    const injectedPrompts: string[] = [];
    const context: HookContext = { toolName, toolArgs: args };

    for (const hook of matching) {
      if (this.isCircular(hook.name)) {
        debugLog(`[HookEngine] Circular skip: "${hook.name}" (preToolUse ${toolName})`);
        continue;
      }

      const startTime = Date.now();
      this.executionStack.add(hook.name);

      try {
        const result = await this.executor.execute(hook, context);
        const duration = Date.now() - startTime;

        // Emit hook firing to UI
        this.emitHookFired(streamHandler, streamId, hook, "preToolUse", toolName, result, duration);

        if (result.status === "denied") {
          this.executionStack.delete(hook.name);
          return {
            denied: true,
            hookName: hook.name,
            reason: result.error,
            injectedPrompts,
          };
        }

        // askAgent hooks inject their prompt into context
        if (hook.then.type === "askAgent" && result.status === "completed" && result.output) {
          injectedPrompts.push(result.output);
        }
      } catch (err) {
        debugError(`[HookEngine] preToolUse hook "${hook.name}" error`, err as Error);
      } finally {
        this.executionStack.delete(hook.name);
      }
    }

    return { denied: false, injectedPrompts };
  }

  /**
   * Fire postToolUse hooks after a tool has executed.
   * Also handles fileCreated/fileEdited hooks for write tools.
   */
  async firePostToolUse(
    toolName: string,
    args: Record<string, unknown>,
    toolResult: string,
    streamHandler: StreamHandler,
    streamId: string
  ): Promise<PostToolUseHookResult> {
    await this.initialize();

    const category = this.classifyTool(toolName);
    const injectedPrompts: string[] = [];

    // 1. Fire postToolUse hooks
    const postHooks = this.getMatchingToolHooks("postToolUse", toolName, category);
    const context: HookContext = { toolName, toolArgs: args, toolResult };

    for (const hook of postHooks) {
      if (this.isCircular(hook.name)) continue;

      const startTime = Date.now();
      this.executionStack.add(hook.name);

      try {
        const result = await this.executor.execute(hook, context);
        const duration = Date.now() - startTime;
        this.emitHookFired(streamHandler, streamId, hook, "postToolUse", toolName, result, duration);

        if (hook.then.type === "askAgent" && result.status === "completed" && result.output) {
          injectedPrompts.push(result.output);
        }
      } catch (err) {
        debugError(`[HookEngine] postToolUse hook "${hook.name}" error`, err as Error);
      } finally {
        this.executionStack.delete(hook.name);
      }
    }

    // 2. Fire fileCreated/fileEdited hooks for write-type tools
    if (category === "write") {
      const filePath = this.extractFilePath(toolName, args);
      if (filePath) {
        const filePrompts = await this.fireFileHooks(filePath, toolName, streamHandler, streamId);
        injectedPrompts.push(...filePrompts);
      }
    }

    return { injectedPrompts };
  }

  /**
   * Fire promptSubmit hooks when user sends a message.
   */
  async firePromptSubmit(
    text: string,
    streamHandler: StreamHandler,
    streamId?: string
  ): Promise<string[]> {
    await this.initialize();

    const matching = filterHooksByType(this.hooks, "promptSubmit");
    if (matching.length === 0) return [];

    const injectedPrompts: string[] = [];
    const sid = streamId || `hook-prompt-${Date.now()}`;

    for (const hook of matching) {
      if (this.isCircular(hook.name)) continue;

      const startTime = Date.now();
      this.executionStack.add(hook.name);

      try {
        const context: HookContext = { toolArgs: { text } };
        const result = await this.executor.execute(hook, context);
        const duration = Date.now() - startTime;

        this.emitHookFired(streamHandler, sid, hook, "promptSubmit", undefined, result, duration);

        if (hook.then.type === "askAgent" && result.status === "completed" && result.output) {
          injectedPrompts.push(result.output);
        }
      } catch (err) {
        debugError(`[HookEngine] promptSubmit hook "${hook.name}" error`, err as Error);
      } finally {
        this.executionStack.delete(hook.name);
      }
    }

    return injectedPrompts;
  }

  /**
   * Fire agentStop hooks when LangGraph execution completes.
   */
  async fireAgentStop(
    streamHandler: StreamHandler,
    streamId?: string
  ): Promise<string[]> {
    await this.initialize();

    const matching = filterHooksByType(this.hooks, "agentStop");
    if (matching.length === 0) return [];

    const injectedPrompts: string[] = [];
    const sid = streamId || `hook-stop-${Date.now()}`;

    for (const hook of matching) {
      if (this.isCircular(hook.name)) continue;

      const startTime = Date.now();
      this.executionStack.add(hook.name);

      try {
        const context: HookContext = {};
        const result = await this.executor.execute(hook, context);
        const duration = Date.now() - startTime;

        this.emitHookFired(streamHandler, sid, hook, "agentStop", undefined, result, duration);

        if (hook.then.type === "askAgent" && result.status === "completed" && result.output) {
          injectedPrompts.push(result.output);
        }
      } catch (err) {
        debugError(`[HookEngine] agentStop hook "${hook.name}" error`, err as Error);
      } finally {
        this.executionStack.delete(hook.name);
      }
    }

    return injectedPrompts;
  }

  /**
   * Get currently loaded hook count (for diagnostics).
   */
  getHookCount(): number {
    return this.hooks.length;
  }

  /**
   * Dispose resources.
   */
  dispose(): void {
    this.outputChannel.dispose();
    this.hooks = [];
    this.loaded = false;
    this.executionStack.clear();
  }

  // === Private Methods ===

  /**
   * Fire fileCreated/fileEdited hooks for a written file path.
   */
  private async fireFileHooks(
    filePath: string,
    toolName: string,
    streamHandler: StreamHandler,
    streamId: string
  ): Promise<string[]> {
    // Determine event type based on tool (fs_write = create, str_replace/fs_append = edit)
    const eventType = toolName === "fs_write" || toolName === "stream_write_file"
      ? "fileCreated"
      : "fileEdited";

    const matching = this.hooks.filter(h => {
      if (h.when.type !== eventType) return false;
      if (!h.when.patterns || h.when.patterns.length === 0) return true;
      return h.when.patterns.some(pattern => this.matchGlob(pattern, filePath));
    });

    const injectedPrompts: string[] = [];
    const context: HookContext = {
      toolName,
      toolArgs: { filePath },
      toolResult: filePath,
    };

    for (const hook of matching) {
      if (this.isCircular(hook.name)) continue;

      const startTime = Date.now();
      this.executionStack.add(hook.name);

      try {
        const result = await this.executor.execute(hook, context);
        const duration = Date.now() - startTime;
        this.emitHookFired(streamHandler, streamId, hook, eventType, filePath, result, duration);

        if (hook.then.type === "askAgent" && result.status === "completed" && result.output) {
          injectedPrompts.push(result.output);
        }
      } catch (err) {
        debugError(`[HookEngine] ${eventType} hook "${hook.name}" error`, err as Error);
      } finally {
        this.executionStack.delete(hook.name);
      }
    }

    return injectedPrompts;
  }

  /**
   * Emit hook firing as a visible tool call block in the chat UI.
   */
  private emitHookFired(
    streamHandler: StreamHandler,
    streamId: string,
    hook: HookDefinition,
    event: string,
    toolName: string | undefined,
    result: HookResult,
    duration: number
  ): void {
    const statusMap: Record<string, string> = {
      completed: "completed",
      failed: "failed",
      timed_out: "failed",
      denied: "completed",
    };

    streamHandler.emitDirect({
      type: "chat:toolCall",
      toolCall: {
        id: `hook-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: "hook_fired",
        args: {
          hookName: hook.name,
          event,
          toolName: toolName || "",
          action: hook.then.type,
        },
        status: statusMap[result.status] || "failed",
        result: result.output
          ? result.output.slice(0, 200)
          : result.error || result.status,
        duration,
      },
    } as any);
  }

  /**
   * Classify tool name into a category for hook matching.
   */
  private classifyTool(toolName: string): string {
    return TOOL_CATEGORIES[toolName] || "other";
  }

  /**
   * Get hooks matching a tool event type and tool name/category.
   */
  private getMatchingToolHooks(
    eventType: "preToolUse" | "postToolUse",
    toolName: string,
    category: string
  ): HookDefinition[] {
    return this.hooks.filter(h => {
      if (h.when.type !== eventType) return false;
      return this.matchesToolType(h, toolName, category);
    });
  }

  /**
   * Check if a hook's toolTypes match the given tool name or category.
   */
  private matchesToolType(hook: HookDefinition, toolName: string, category: string): boolean {
    const toolTypes = hook.when.toolTypes;
    if (!toolTypes || toolTypes.length === 0) return true; // no filter = match all
    return toolTypes.some(pattern => {
      if (pattern === "*") return true;
      if (pattern === category) return true;
      if (pattern === toolName) return true;
      try {
        return new RegExp(pattern).test(toolName);
      } catch {
        return false;
      }
    });
  }

  /**
   * Check for circular hook execution (same hook re-firing).
   */
  private isCircular(hookName: string): boolean {
    return this.executionStack.has(hookName);
  }

  /**
   * Extract file path from tool arguments based on tool name.
   */
  private extractFilePath(toolName: string, args: Record<string, unknown>): string | null {
    if (args.path && typeof args.path === "string") return args.path;
    if (args.file_path && typeof args.file_path === "string") return args.file_path;
    if (args.targetFile && typeof args.targetFile === "string") return args.targetFile;
    // str_replace uses "path" param
    if (toolName === "str_replace" && args.path) return args.path as string;
    return null;
  }

  /**
   * Simple glob matching (supports * and **).
   */
  private matchGlob(pattern: string, filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const regex = pattern
      .replace(/\./g, "\\.")
      .replace(/\*\*/g, "<<<GLOBSTAR>>>")
      .replace(/\*/g, "[^/]*")
      .replace(/<<<GLOBSTAR>>>/g, ".*");
    try {
      return new RegExp(`^${regex}$`).test(normalizedPath) ||
        new RegExp(regex).test(normalizedPath);
    } catch {
      return false;
    }
  }
}
