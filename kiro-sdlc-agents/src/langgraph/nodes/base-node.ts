/**
 * BaseNode — KSA-210 + KSA-233 + KSA-242
 * Abstract base class for all LangGraph pipeline nodes.
 * Provides timeout, retry loop, error handling, streaming, MCP tool call, LLM wrappers,
 * and workspace utility methods (readFile, writeFile, Jira, DOCX export, draw.io).
 */

import { McpBridge } from "../mcp-bridge";
import { StreamHandler } from "../stream-handler";
import { PipelineState, PipelineError } from "../state";
import { NonRecoverableError } from "../errors/non-recoverable-error";
import type { LlmProvider, LlmMessage, LlmOptions } from "../llm-provider";
import {
  loadHooks, filterHooksByType, filterPreToolUseHooks, filterFileHooks,
  type HookDefinition,
} from "../hook-loader";
import { WorkflowExecutor, type WorkflowNodeContext } from "../workflow-executor";

/** Maximum node execution time (300s per TDD Section 5.4) */
const NODE_TIMEOUT_MS = 300_000;

/** Per-tool call timeout (60s per TDD Section 3.3) */
const TOOL_CALL_TIMEOUT_MS = 60_000;

/** Extended timeout for DOCX export and draw.io PNG export (90s) */
const EXPORT_TIMEOUT_MS = 90_000;

export abstract class BaseNode {
  /** Maximum retry attempts (KSA-233: default 2) */
  private static readonly MAX_RETRIES = 2;

  constructor(
    protected readonly nodeId: string,
    protected readonly mcpBridge: McpBridge,
    protected readonly streamHandler: StreamHandler,
    protected readonly llmProvider?: LlmProvider
  ) {}

  /** Subclasses implement core logic here */
  abstract execute(state: PipelineState): Promise<Partial<PipelineState>>;

  /**
   * Wraps execute() with timeout, retry loop, status streaming, and error handling.
   * This is the method registered as the LangGraph node function.
   *
   * Retry flow (KSA-233, implements UC-1):
   *   1. Call execute() with timeout
   *   2. If NonRecoverableError -> fail immediately (EF-2)
   *   3. If error and retryCount < MAX_RETRIES -> emit retry event, wait backoff, re-execute
   *   4. If all retries exhausted -> emit error, return failed state (EF-1)
   *   5. If success -> emit complete, return result
   */
  async run(state: PipelineState): Promise<Partial<PipelineState>> {
    const startTime = Date.now();
    const maxRetries = BaseNode.MAX_RETRIES;
    let currentRetryCount = state.retryCount?.[this.nodeId] ?? 0;

    this.streamHandler.emitStatus(this.nodeId, "active", state.currentStreamId);

    // Initial attempt + retry loop
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.withTimeout(this.execute(state), NODE_TIMEOUT_MS);
        const duration = Date.now() - startTime;
        this.streamHandler.emitComplete(this.nodeId, duration, state.currentStreamId);

        // KSA-242: Fire agentStop hooks after successful execution
        const outputContent = result.agentOutputs?.[0]?.content || "";
        await this.fireAgentStopHooks(state, outputContent);

        return {
          ...result,
          retryCount: { ...state.retryCount, [this.nodeId]: currentRetryCount },
          lastUpdatedAt: new Date().toISOString(),
        };
      } catch (error) {
        const err = error as Error;

        // EF-2: Non-recoverable errors bypass retry entirely
        if (err instanceof NonRecoverableError) {
          return this.buildFailureState(state, err, currentRetryCount);
        }

        // Check if more retries available
        if (attempt < maxRetries) {
          currentRetryCount++;
          const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s

          // Emit retry event (BR-19: real-time)
          this.streamHandler.emitRetry(
            this.nodeId, attempt + 1, maxRetries, delayMs,
            err.message, state.currentStreamId
          );

          // Exponential backoff delay
          await this.sleep(delayMs);
          // Continue loop -> re-execute
        } else {
          // EF-1: All retries exhausted
          currentRetryCount++;
          return this.buildFailureState(state, err, currentRetryCount);
        }
      }
    }

    // Should never reach here, but TypeScript needs it
    return { pipelineStatus: "failed", lastUpdatedAt: new Date().toISOString() };
  }

  /**
   * Call an MCP tool via bridge with standard timeout.
   */
  protected async callMcp(toolName: string, args: Record<string, unknown>): Promise<string> {
    return this.mcpBridge.callTool(toolName, args, TOOL_CALL_TIMEOUT_MS);
  }

  /**
   * Call the LLM with system + user prompts and return the full response.
   * Falls back to MCP invoke_sub_agent if LLM provider is unavailable.
   */
  protected async callLlm(systemPrompt: string, userPrompt: string, options?: LlmOptions): Promise<string> {
    if (!this.llmProvider) {
      throw new Error(`No LLM provider configured for node '${this.nodeId}'`);
    }

    const messages: LlmMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    return this.llmProvider.chat(messages, options);
  }

  /**
   * Call the LLM with streaming, emitting tokens to the Chat Panel in real-time.
   * Yields each token chunk for callers that need to process the stream.
   */
  protected async *callLlmStream(
    systemPrompt: string,
    userPrompt: string,
    state: PipelineState,
    options?: LlmOptions
  ): AsyncGenerator<string> {
    if (!this.llmProvider) {
      throw new Error(`No LLM provider configured for node '${this.nodeId}'`);
    }

    const messages: LlmMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const stream = this.llmProvider.chatStream(messages, options);

    for await (const token of stream) {
      // Emit each token to the Chat Panel UI
      this.streamHandler.emitToken(this.nodeId, token, state.currentStreamId);
      yield token;
    }
  }

  /**
   * Convenience: stream LLM and collect the full response as a string.
   * Tokens are emitted to Chat Panel as they arrive.
   */
  protected async callLlmStreamFull(
    systemPrompt: string,
    userPrompt: string,
    state: PipelineState,
    options?: LlmOptions
  ): Promise<string> {
    let result = "";
    for await (const token of this.callLlmStream(systemPrompt, userPrompt, state, options)) {
      result += token;
    }
    return result;
  }

  /**
   * Check if the LLM provider is available for direct calls.
   */
  protected async isLlmAvailable(): Promise<boolean> {
    if (!this.llmProvider) { return false; }
    return this.llmProvider.isAvailable();
  }

  /**
   * Race a promise against a timeout.
   */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Node '${this.nodeId}' timed out after ${ms}ms`));
      }, ms);
      timer.unref?.();

      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Build failure state after retries exhausted or non-recoverable error (KSA-233).
   */
  private buildFailureState(
    state: PipelineState, error: Error, retryCount: number
  ): Partial<PipelineState> {
    const pipelineError: PipelineError = {
      nodeId: this.nodeId,
      code: error.name || "NODE_FAILED",
      message: error.message,
      timestamp: new Date().toISOString(),
      recoverable: !(error instanceof NonRecoverableError),
    };

    this.streamHandler.emitError(this.nodeId, error.message, state.currentStreamId);

    return {
      errors: [...(state.errors || []), pipelineError],
      retryCount: { ...state.retryCount, [this.nodeId]: retryCount },
      pipelineStatus: "failed",
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  /** Async sleep utility for backoff delay (KSA-233) */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =========================================================================
  // KSA-242: Workspace Utility Methods
  // =========================================================================

  /**
   * Read a workspace file via VS Code API.
   * Returns file content as string, or null if file doesn't exist.
   */
  protected async readWorkspaceFile(relativePath: string): Promise<string | null> {
    try {
      const vscode = require("vscode");
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) return null;
      const path = require("path");
      const fullPath = path.join(workspaceRoot, relativePath);
      const uri = vscode.Uri.file(fullPath);
      const bytes = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(bytes).toString("utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Write content to a workspace file via stream_write_file MCP tool.
   * Creates parent directories if needed.
   * Fires preToolUse("write") hooks and fileCreated hooks.
   */
  protected async writeWorkspaceFile(relativePath: string, content: string): Promise<boolean> {
    // KSA-242: Fire preToolUse hooks for write operations
    const preHookInstructions = await this.firePreToolUseHooks("write");

    // If writing a .drawio file, execute draw.io specific hooks (KB lookup)
    if (relativePath.endsWith(".drawio")) {
      for (const instruction of preHookInstructions) {
        if (instruction.includes("drawio") && instruction.includes("mem_search")) {
          await this.kbSearch("drawio procedure styles edges containers");
        }
      }
    }

    try {
      const result = await this.callMcp("stream_write_file", {
        file_path: relativePath,
        content,
        mode: "write",
      });

      // Fire fileCreated hooks
      await this.fireFileHooks("fileCreated", relativePath, { ticketKey: "" } as PipelineState);

      return !result.includes("error");
    } catch {
      // Fallback: try via vscode API
      try {
        const vscode = require("vscode");
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return false;
        const path = require("path");
        const fullPath = path.join(workspaceRoot, relativePath);
        const uri = vscode.Uri.file(fullPath);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Append content to an existing workspace file.
   */
  protected async appendWorkspaceFile(relativePath: string, content: string): Promise<boolean> {
    try {
      const result = await this.callMcp("stream_write_file", {
        file_path: relativePath,
        content,
        mode: "append",
      });
      return !result.includes("error");
    } catch {
      return false;
    }
  }

  /**
   * Call a dynamic tool via MCP orchestration (for tools like jira_*, embed_images, export_docx).
   * Routes through execute_dynamic_tool which handles server discovery.
   */
  protected async callDynamicTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    return this.mcpBridge.callTool("execute_dynamic_tool", {
      tool_name: toolName,
      arguments: args,
    }, TOOL_CALL_TIMEOUT_MS);
  }

  /**
   * Get Jira issue full details.
   */
  protected async getJiraIssue(issueKey: string): Promise<string> {
    return this.callDynamicTool("jira_get_issue", {
      issue_key: issueKey,
      fields: "*all",
      expand: "renderedFields",
    });
  }

  /**
   * Get Jira issue with specific fields.
   */
  protected async getJiraIssueFields(issueKey: string, fields: string): Promise<string> {
    return this.callDynamicTool("jira_get_issue", {
      issue_key: issueKey,
      fields,
    });
  }

  /**
   * Search Jira issues by JQL.
   */
  protected async searchJira(jql: string): Promise<string> {
    return this.callDynamicTool("jira_search", { jql });
  }

  /**
   * Search KB (knowledge base) for relevant context.
   */
  protected async kbSearch(query: string, limit = 10): Promise<string> {
    return this.callMcp("mem_search", { query, limit });
  }

  /**
   * Ingest content into KB.
   */
  protected async kbIngest(content: string, type: string, source: string, tags: string[]): Promise<void> {
    try {
      await this.callMcp("mem_ingest", { content, type, source, tags });
    } catch {
      // Non-blocking
    }
  }

  /**
   * Ingest a file into KB by path (more efficient for large files).
   */
  protected async kbIngestFile(filePath: string, type = "DOCUMENT"): Promise<void> {
    try {
      await this.callMcp("mem_ingest_file", { file_path: filePath, type });
    } catch {
      // Non-blocking
    }
  }

  /**
   * Read code intelligence data (project structure, module analysis).
   * Returns combined content or null if not available.
   */
  protected async readCodeIntelligence(moduleName?: string): Promise<string | null> {
    const projectStructure = await this.readWorkspaceFile(
      ".analysis/code-intelligence/project-structure.md"
    );
    if (!moduleName) return projectStructure;

    const moduleAnalysis = await this.readWorkspaceFile(
      `.analysis/code-intelligence/modules/${moduleName}.md`
    );
    return [projectStructure, moduleAnalysis].filter(Boolean).join("\n\n---\n\n");
  }

  /**
   * Export a markdown file to DOCX via embed_images → export_docx pipeline.
   * Returns path to generated DOCX or null on failure.
   */
  protected async exportDocx(mdRelativePath: string, docxFileName: string): Promise<string | null> {
    try {
      const workspaceRoot = this.getWorkspaceRoot();
      if (!workspaceRoot) return null;
      const path = require("path");

      const absoluteMdPath = path.join(workspaceRoot, mdRelativePath);
      const embeddedPath = absoluteMdPath.replace(/\.md$/, "-embedded.md");

      // Step 1: Embed images (convert relative img refs to base64)
      await this.mcpBridge.callTool("execute_dynamic_tool", {
        tool_name: "embed_images",
        arguments: { file_path: absoluteMdPath, output_path: embeddedPath },
      }, EXPORT_TIMEOUT_MS);

      // Step 2: Export to DOCX
      const result = await this.mcpBridge.callTool("execute_dynamic_tool", {
        tool_name: "export_docx",
        arguments: { file_path: embeddedPath, file_name: docxFileName },
      }, EXPORT_TIMEOUT_MS);

      // Step 3: Clean up embedded temp file
      try {
        const vscode = require("vscode");
        const embeddedUri = vscode.Uri.file(embeddedPath);
        await vscode.workspace.fs.delete(embeddedUri);
      } catch { /* ignore cleanup failure */ }

      return result || `${docxFileName}.docx`;
    } catch {
      return null;
    }
  }

  /**
   * Export a draw.io file to PNG using the drawio_export_png MCP tool.
   * Returns true if successful.
   */
  protected async exportDrawioPng(drawioRelativePath: string): Promise<boolean> {
    try {
      const result = await this.mcpBridge.callTool("drawio_export_png", {
        file_path: drawioRelativePath,
      }, EXPORT_TIMEOUT_MS);
      return !result.includes("error") && !result.includes("Error");
    } catch {
      return false;
    }
  }

  /**
   * Get workspace root path.
   */
  protected getWorkspaceRoot(): string | null {
    try {
      const vscode = require("vscode");
      return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    } catch {
      return null;
    }
  }

  // =========================================================================
  // KSA-242: Shell Execution
  // =========================================================================

  /**
   * Discover available MCP tools matching a query.
   * Mimics Kiro agent's "find_tools" first step for dynamic tool discovery.
   * Returns tool list as string for context or empty string if unavailable.
   */
  protected async discoverTools(query: string, threshold = 0.4, topK = 5): Promise<string> {
    try {
      return await this.callMcp("find_tools", { query, threshold, top_k: topK });
    } catch {
      return "";
    }
  }

  /**
   * Load agent system prompt dynamically from .kiro/agents/{agentName}.md.
   * Strips front-matter AND workflow/tool-call sections, keeping only:
   * - Role description (identity, responsibilities)
   * - Quality rules (diagram rules, formatting, language)
   * - Document standards (template structure expectations)
   *
   * Workflow steps (tool calls, file operations) are EXCLUDED because
   * the node code handles those directly — LLM only generates content.
   *
   * Falls back to provided default if file not found.
   */
  protected async loadAgentPrompt(agentName: string, fallback: string): Promise<string> {
    const content = await this.readWorkspaceFile(`.kiro/agents/${agentName}.md`);
    if (!content) return fallback;

    // Strip front-matter (--- ... ---)
    const fmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
    const body = fmMatch ? fmMatch[1].trim() : content.trim();

    // Extract only role/rules sections, skip workflow steps
    const filtered = this.extractRoleSections(body);

    // If extraction yields too little, use fallback
    if (filtered.length < 100) return fallback;

    // Truncate to keep within LLM context budget
    if (filtered.length > 20000) {
      return filtered.slice(0, 20000) + "\n\n[...truncated for context budget]";
    }

    return filtered;
  }

  /**
   * Extract role description and quality rules from agent markdown.
   * Excludes sections that contain tool-call instructions or workflow steps.
   */
  private extractRoleSections(markdown: string): string {
    const lines = markdown.split("\n");
    const result: string[] = [];
    let inWorkflowSection = false;
    let currentHeadingLevel = 0;

    // Patterns that indicate workflow/tool-call sections to SKIP
    const workflowPatterns = [
      /^##\s*(step\s+\d|workflow|tool\s+discovery)/i,
      /^###\s*step\s+\d/i,
      /^##\s*⚙️\s*tool\s+discovery/i,
      /^##\s*input\s+format/i,
      /^###\s*step\s+\d.*:(.*fetch|read|export|ingest|generate|write)/i,
    ];

    // Patterns that indicate we should INCLUDE
    const includePatterns = [
      /^##\s*(language|document\s+types|diagram|quality|rules|brd\s+template|fsd\s+template)/i,
      /^##\s*(mandatory|critical)/i,
      /^you\s+are\s+a\s+senior/i,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this is a heading
      const headingMatch = line.match(/^(#{1,4})\s+/);

      if (headingMatch) {
        const level = headingMatch[1].length;

        // Check if heading matches workflow patterns → skip section
        if (workflowPatterns.some(p => p.test(line))) {
          inWorkflowSection = true;
          currentHeadingLevel = level;
          continue;
        }

        // Check if heading matches include patterns or is a new top-level section
        if (includePatterns.some(p => p.test(line)) || level <= currentHeadingLevel) {
          inWorkflowSection = false;
        }

        // Any new same-or-higher level heading exits workflow section
        if (inWorkflowSection && level <= currentHeadingLevel) {
          inWorkflowSection = false;
        }
      }

      if (!inWorkflowSection) {
        // Also skip individual lines that are clearly tool-call instructions
        if (this.isToolCallLine(line)) continue;
        result.push(line);
      }
    }

    return result.join("\n").trim();
  }

  /**
   * Check if a line is a tool-call instruction that should be excluded.
   */
  private isToolCallLine(line: string): boolean {
    const trimmed = line.trim();
    if (/^\d+\.\s*(Use\s+`?(readFile|fsWrite|executePwsh|stream_write_file|mem_ingest|mem_search|embed_images|export_docx))/i.test(trimmed)) return true;
    if (/^\s*&\s+"C:\\Program Files/.test(trimmed)) return true;
    if (/^\s*(the discovered|Use the discovered)\s+\*\*/.test(trimmed)) return true;
    return false;
  }

  // =========================================================================
  // KSA-243: Dynamic Workflow Execution
  // =========================================================================

  /**
   * Create a WorkflowExecutor and run an agent workflow dynamically.
   * Parses .kiro/agents/{agentName}.md at runtime, extracts steps, and executes them.
   *
   * Usage:
   *   const result = await this.runAgentWorkflow("ba-agent", state, { docType: "BRD" });
   */
  protected async runAgentWorkflow(
    agentName: string,
    state: PipelineState,
    vars: Record<string, string> = {}
  ): Promise<string> {
    const executor = new WorkflowExecutor(this as unknown as WorkflowNodeContext);
    return executor.run(agentName, state, vars);
  }

  // =========================================================================
  // KSA-242: Dynamic Hook Execution
  // =========================================================================

  /**
   * Load hooks from workspace .kiro/hooks/ directory.
   */
  private async getHooks(): Promise<HookDefinition[]> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) return [];
    return loadHooks(workspaceRoot);
  }

  /**
   * Fire "agentStop" hooks after node execution completes.
   * Executes runCommand or askAgent actions from matching hooks.
   */
  protected async fireAgentStopHooks(state: PipelineState, output: string): Promise<void> {
    try {
      const hooks = await this.getHooks();
      const matching = filterHooksByType(hooks, "agentStop");

      for (const hook of matching) {
        await this.executeHookAction(hook, state, output);
      }
    } catch {
      // Hook execution failure is non-blocking
    }
  }

  /**
   * Fire "preToolUse" hooks before a tool call.
   * Returns the hook prompts/instructions to apply, or empty array if none.
   */
  protected async firePreToolUseHooks(toolCategory: string): Promise<string[]> {
    try {
      const hooks = await this.getHooks();
      const matching = filterPreToolUseHooks(hooks, toolCategory);

      return matching
        .filter(h => h.then.type === "askAgent" && h.then.prompt)
        .map(h => h.then.prompt!);
    } catch {
      return [];
    }
  }

  /**
   * Fire "fileEdited" or "fileCreated" hooks after writing a file.
   * Executes runCommand actions (like code indexer) for matching file patterns.
   */
  protected async fireFileHooks(
    eventType: "fileEdited" | "fileCreated",
    filePath: string,
    state: PipelineState
  ): Promise<void> {
    try {
      const hooks = await this.getHooks();
      const matching = filterFileHooks(hooks, eventType, filePath);

      for (const hook of matching) {
        await this.executeHookAction(hook, state, "", filePath);
      }
    } catch {
      // Hook execution failure is non-blocking
    }
  }

  /**
   * Execute a single hook action.
   */
  private async executeHookAction(
    hook: HookDefinition,
    state: PipelineState,
    contextContent: string,
    filePath?: string
  ): Promise<void> {
    try {
      if (hook.then.type === "runCommand" && hook.then.command) {
        // Replace ${file} placeholder with actual file path
        const command = filePath
          ? hook.then.command.replace("${file}", filePath)
          : hook.then.command;
        await this.execShell(command);
      } else if (hook.then.type === "askAgent" && hook.then.prompt) {
        // For askAgent hooks, we execute the instruction directly
        // Most common: mem_ingest for logging
        if (hook.then.prompt.includes("mem_ingest")) {
          const summary = contextContent.slice(0, 150);
          await this.kbIngest(
            summary,
            "CONTEXT",
            `hook-${hook.name.toLowerCase().replace(/\s+/g, "-")}`,
            ["hook", this.nodeId, state.ticketKey]
          );
        } else if (hook.then.prompt.includes("mem_search") && hook.then.prompt.includes("drawio")) {
          // Draw.io KB lookup hook — search and apply patterns
          await this.kbSearch("drawio procedure styles edges containers");
        }
      }
    } catch {
      // Individual hook failure is non-blocking
    }
  }

  /**
   * Execute a shell command in the workspace directory.
   * Uses child_process.exec with timeout protection.
   * Returns stdout as string. Throws on non-zero exit code.
   */
  protected async execShell(command: string, cwd?: string): Promise<string> {
    const { exec } = require("child_process");
    const workspaceRoot = this.getWorkspaceRoot();
    const execCwd = cwd || workspaceRoot || process.cwd();

    return new Promise<string>((resolve, reject) => {
      const child = exec(
        command,
        { cwd: execCwd, maxBuffer: 10 * 1024 * 1024, timeout: TOOL_CALL_TIMEOUT_MS },
        (error: Error | null, stdout: string, stderr: string) => {
          if (error) {
            reject(new Error(`Shell command failed: ${command}\n${stderr || error.message}`));
          } else {
            resolve(stdout.trim());
          }
        }
      );
      child.unref?.();
    });
  }

  /**
   * Execute git command in workspace.
   * Convenience wrapper around execShell.
   */
  protected async execGit(args: string): Promise<string> {
    return this.execShell(`git ${args}`);
  }

  // =========================================================================
  // KSA-242: Recursive Jira Traversal
  // =========================================================================

  /**
   * Fetch Jira issue with recursive linked ticket traversal.
   * Mimics Kiro ba-agent Step 2-3: fetch main ticket → fetch all linked → fetch linked-of-linked.
   *
   * @param issueKey - Main ticket key
   * @param maxDepth - Maximum recursion depth (default 2)
   * @param maxTickets - Maximum total tickets to fetch (default 10)
   * @returns Combined context string of all fetched tickets
   */
  protected async getJiraIssueRecursive(
    issueKey: string,
    maxDepth = 2,
    maxTickets = 10
  ): Promise<string> {
    const visited = new Set<string>();
    const results: string[] = [];

    await this.traverseJiraLinks(issueKey, 0, maxDepth, maxTickets, visited, results);

    return results.join("\n\n---\n\n");
  }

  /**
   * Internal recursive helper for Jira traversal.
   */
  private async traverseJiraLinks(
    issueKey: string,
    currentDepth: number,
    maxDepth: number,
    maxTickets: number,
    visited: Set<string>,
    results: string[]
  ): Promise<void> {
    // Guards
    if (visited.has(issueKey)) return;
    if (visited.size >= maxTickets) return;
    if (currentDepth > maxDepth) return;

    visited.add(issueKey);

    try {
      const issueData = await this.getJiraIssue(issueKey);
      const prefix = currentDepth === 0 ? "## MAIN TICKET" : `## LINKED (depth ${currentDepth})`;
      results.push(`${prefix}: ${issueKey}\n\n${issueData}`);

      // Extract linked issue keys from the response
      const linkedKeys = this.extractLinkedKeys(issueData, issueKey);

      // Recurse into linked tickets
      for (const linkedKey of linkedKeys) {
        if (visited.size >= maxTickets) break;
        await this.traverseJiraLinks(linkedKey, currentDepth + 1, maxDepth, maxTickets, visited, results);
      }
    } catch {
      // Single ticket fetch failure is non-blocking
      results.push(`## ${issueKey} — [fetch failed]`);
    }
  }

  /**
   * Extract linked issue keys from Jira issue response.
   * Parses JSON or text response to find related ticket keys.
   */
  private extractLinkedKeys(issueData: string, selfKey: string): string[] {
    const keys: string[] = [];
    // Match Jira issue key pattern in the response
    const keyPattern = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
    let match: RegExpExecArray | null;

    while ((match = keyPattern.exec(issueData)) !== null) {
      const key = match[1];
      if (key !== selfKey && !keys.includes(key)) {
        keys.push(key);
      }
    }

    // Limit to reasonable number to prevent explosion
    return keys.slice(0, 8);
  }
}
