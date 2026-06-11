"use strict";

/**
 * McpServerManager — Spawns and manages the bundled MCP Code Intelligence server.
 * The extension IS the MCP server: it spawns mcp-server/http-entry.js as a child process,
 * detects the listening port from stderr, and provides invokeTool() for JSON-RPC calls.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as net from "net";
import * as crypto from "crypto";
import { ChildProcess, spawn, execSync } from "child_process";
import {
  ServerStatus,
  IServerManager,
  McpRequest,
  McpResponse,
  McpServerNotRunningError,
  McpTimeoutError,
  McpBundleMissingError,
  McpSpawnError,
  SERVER_CONSTANTS,
} from "./types";
import { NativeAddonManager } from "./native-addon-manager";
import { OnnxAddonManager } from "./onnx-addon-manager";

export class McpServerManager implements IServerManager, vscode.Disposable {
  private _status: ServerStatus = "stopped";
  private _port: number | null = null;
  private _pid: number | null = null;
  private childProc: ChildProcess | null = null;
  private restartCount = 0;
  private isDisposing = false;
  private externalServer = false;
  private nativeAddonManager: NativeAddonManager | undefined;
  private onnxAddonManager: OnnxAddonManager | undefined;
  // KSA-112: Track ERR_DLOPEN_FAILED for auto-recovery
  private dlopenErrorDetected = false;
  private mismatchRecoveryAttempted = false;

  private readonly _onStatusChange = new vscode.EventEmitter<ServerStatus>();
  readonly onStatusChange = this._onStatusChange.event;

  constructor(
    private readonly extensionPath: string,
    private readonly workspaceFolder: string,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  /**
   * Set the NativeAddonManager for prebuilt binary resolution.
   */
  setNativeAddonManager(manager: NativeAddonManager): void {
    this.nativeAddonManager = manager;
  }

  /**
   * Set the OnnxAddonManager for prebuilt ONNX Runtime binary resolution.
   */
  setOnnxAddonManager(manager: OnnxAddonManager): void {
    this.onnxAddonManager = manager;
  }

  get status(): ServerStatus {
    return this._status;
  }

  get pid(): number | null {
    return this._pid;
  }

  get port(): number | null {
    return this._port;
  }

  /** Viewer is served on the same port as MCP (http-entry.js proxies it). */
  get viewerPort(): number | null {
    return this._port;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Spawn the bundled MCP server process.
   * If the configured port is already listening, connect directly without spawning.
   */
  async spawn(): Promise<void> {
    if (this._status === "running") {
      return;
    }

    this.setStatus("starting");

    const configuredPort = this.getConfiguredPort();

    // Check if port is already in use → external server running
    if (await this.isPortListening(configuredPort)) {
      this.outputChannel.appendLine(`[MCP] Port ${configuredPort} already in use — connecting to existing server.`);
      this._port = configuredPort;
      this._pid = null;
      this.externalServer = true;
      this.setStatus("running");
      this.updateMcpJson();
      return;
    }

    // Ensure native addon is available (KSA-175: Runtime Self-Download)
    // KSA-112: Detect and recover from NODE_MODULE_VERSION mismatch
    let nativeBindingPath: string | undefined;
    if (this.nativeAddonManager) {
      const addonPath = await this.nativeAddonManager.ensure();
      if (!addonPath) {
        this.setStatus("stopped");
        this.outputChannel.appendLine("[MCP] Native addon unavailable. Server not started.");
        return;
      }
      nativeBindingPath = addonPath;
      this.outputChannel.appendLine(`[MCP] Native addon resolved: ${addonPath}`);
    }

    // Ensure ONNX Runtime is available (optional — embedding features)
    let onnxRuntimePath: string | undefined;
    if (this.onnxAddonManager) {
      const onnxPath = await this.onnxAddonManager.ensure();
      if (onnxPath) {
        onnxRuntimePath = onnxPath;
        this.outputChannel.appendLine(`[MCP] ONNX Runtime resolved: ${onnxPath}`);
      } else {
        this.outputChannel.appendLine("[MCP] ONNX Runtime unavailable — embedding features disabled.");
      }
    }

    // Verify bundle exists
    const entryPath = path.join(this.extensionPath, "mcp-server", "http-entry.js");
    if (!fs.existsSync(entryPath)) {
      this.setStatus("stopped");
      throw new McpBundleMissingError();
    }

    const configPath = this.getConfigPath();

    // Build NODE_PATH so onnxruntime-node can resolve onnxruntime-common (sibling dir)
    const nodePath = onnxRuntimePath
      ? [path.dirname(onnxRuntimePath), process.env.NODE_PATH].filter(Boolean).join(path.delimiter)
      : process.env.NODE_PATH;

    // Spawn child process using the same Node binary as the extension host (Kiro's bundled node).
    // Using process.execPath ensures we don't accidentally use a different system node version.
    const nodeExe = process.execPath;
    this.outputChannel.appendLine(`[MCP] Using Node runtime: ${nodeExe} (v${process.versions.node})`);
    const child = spawn(nodeExe, [entryPath, "--port", String(configuredPort), "--config", configPath], {
      cwd: this.workspaceFolder,
      env: {
        ...process.env,
        NODE_ENV: "production",
        CODE_INTEL_VIEWER_PORT: "-1",
        ...(nativeBindingPath ? { BETTER_SQLITE3_BINDING: nativeBindingPath } : {}),
        ...(onnxRuntimePath ? { ONNX_RUNTIME_PATH: onnxRuntimePath } : {}),
        ...(nodePath ? { NODE_PATH: nodePath } : {}),
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    this.childProc = child;
    this._pid = child.pid ?? null;

    // Write PID file
    this.writePidFile();

    // Wait for port detection from stderr
    const detectedPort = await this.waitForPort(child, configuredPort);
    this._port = detectedPort;
    this.externalServer = false;
    this.setStatus("running");
    this.outputChannel.appendLine(`[MCP] Server running on port ${detectedPort} (PID: ${this._pid})`);

    // Update mcp.json with httpStream URL
    this.updateMcpJson();

    // Handle crash / exit
    child.on("exit", (code, signal) => {
      if (this.isDisposing) {
        return;
      }
      this.outputChannel.appendLine(`[MCP] Server exited (code=${code}, signal=${signal})`);
      this._pid = null;
      this._port = null;
      this.childProc = null;
      this.removePidFile();

      // KSA-112: Check if crash was due to MODULE_VERSION mismatch
      if (this.dlopenErrorDetected && this.nativeAddonManager && !this.mismatchRecoveryAttempted) {
        this.mismatchRecoveryAttempted = true;
        this.dlopenErrorDetected = false;
        this.outputChannel.appendLine("[MCP] ⚠️ ERR_DLOPEN_FAILED detected — NODE_MODULE_VERSION mismatch.");
        this.outputChannel.appendLine("[MCP] Auto-recovering: deleting cached addon and re-downloading for correct runtime...");
        this.handleModuleVersionMismatch();
        return;
      }
      this.dlopenErrorDetected = false;

      if (this.restartCount < SERVER_CONSTANTS.MAX_RESTARTS) {
        this.setStatus("crashed");
        const backoff = SERVER_CONSTANTS.BACKOFF_MS[this.restartCount] ?? 30000;
        this.restartCount++;
        this.outputChannel.appendLine(`[MCP] Crash recovery ${this.restartCount}/${SERVER_CONSTANTS.MAX_RESTARTS} — retrying in ${backoff}ms`);
        setTimeout(() => {
          if (!this.isDisposing) {
            this.spawn().catch((err) => {
              this.outputChannel.appendLine(`[MCP] Restart failed: ${(err as Error).message}`);
            });
          }
        }, backoff);
      } else {
        this.setStatus("crashed");
        this.outputChannel.appendLine("[MCP] Max restarts reached. Server will not auto-restart.");
      }
    });

    // Pipe stderr to output channel (after port detection)
    // KSA-112: Also detect ERR_DLOPEN_FAILED for auto-recovery
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      try { this.outputChannel.appendLine(text.trimEnd()); } catch (e) {
        console.error("[kiro-sdlc] OutputChannel write failed:", (e as Error).message);
      }
      if (text.includes("ERR_DLOPEN_FAILED") || text.includes("NODE_MODULE_VERSION")) {
        this.dlopenErrorDetected = true;
      }
    });
  }

  /**
   * Kill the server process.
   */
  async kill(): Promise<void> {
    if (this.externalServer) {
      this._port = null;
      this.setStatus("stopped");
      this.outputChannel.appendLine("[MCP] Disconnected from external server.");
      return;
    }

    if (!this.childProc && !this._pid) {
      this.setStatus("stopped");
      return;
    }

    this.outputChannel.appendLine("[MCP] Killing server...");

    try {
      if (process.platform === "win32" && this._pid) {
        execSync(`taskkill /PID ${this._pid} /T /F`, { timeout: SERVER_CONSTANTS.KILL_TIMEOUT_MS });
      } else if (this.childProc) {
        this.childProc.kill("SIGTERM");
      }
    } catch (err) {
      this.outputChannel.appendLine(`[MCP] Kill warning: ${(err as Error).message}`);
    }

    this.childProc = null;
    this._pid = null;
    this._port = null;
    this.removePidFile();
    this.setStatus("stopped");
  }

  /**
   * Restart: kill then spawn.
   */
  async restart(): Promise<void> {
    this.outputChannel.appendLine("[MCP] Restarting...");
    this.restartCount = 0; // manual restart resets counter
    await this.kill();
    await this.spawn();
  }

  /**
   * Invoke an MCP tool via HTTP POST to /mcp.
   */
  async invokeTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (this._status !== "running" || !this._port) {
      throw new McpServerNotRunningError();
    }

    const request: McpRequest = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    };

    const url = `http://127.0.0.1:${this._port}/mcp`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SERVER_CONSTANTS.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as McpResponse;

      if (data.error) {
        throw new Error(`MCP error (${data.error.code}): ${data.error.message}`);
      }

      return data.result?.content?.[0]?.text ?? "";
    } catch (err: unknown) {
      clearTimeout(timeout);
      if ((err as Error).name === "AbortError") {
        throw new McpTimeoutError(name, SERVER_CONSTANTS.REQUEST_TIMEOUT_MS);
      }
      throw err;
    }
  }

  /**
   * Dispose — kill server and clean up.
   */
  dispose(): void {
    this.isDisposing = true;
    this.kill().catch(() => {});
    this._onStatusChange.dispose();
  }

  /**
   * KSA-112: Handle NODE_MODULE_VERSION mismatch.
   * Deletes the wrong cached addon and re-downloads for the correct runtime version.
   * Then restarts the server.
   */
  private async handleModuleVersionMismatch(): Promise<void> {
    this.setStatus("starting");

    try {
      if (this.nativeAddonManager) {
        this.outputChannel.appendLine("[MCP] Deleting mismatched native addon cache...");
        const newPath = await this.nativeAddonManager.redownload();
        if (newPath) {
          this.outputChannel.appendLine(`[MCP] ✅ Re-downloaded correct addon: ${newPath}`);
          // Reset restart count — this is a recovery, not a crash loop
          this.restartCount = 0;
          await this.spawn();
          return;
        }
      }

      // Recovery failed — report to user
      this.setStatus("crashed");
      this.outputChannel.appendLine("[MCP] ❌ Auto-recovery failed. Please restart Kiro IDE.");
      vscode.window.showErrorMessage(
        "MCP server crashed due to Node.js version mismatch (ERR_DLOPEN_FAILED). " +
        "Auto-recovery failed. Try: 1) Restart Kiro IDE, or 2) Delete native addon cache manually.",
        "Retry",
        "Open Output"
      ).then((action) => {
        if (action === "Retry") {
          this.mismatchRecoveryAttempted = false;
          this.restartCount = 0;
          this.spawn().catch(() => {});
        } else if (action === "Open Output") {
          this.outputChannel.show();
        }
      });
    } catch (err: any) {
      this.setStatus("crashed");
      this.outputChannel.appendLine(`[MCP] Recovery error: ${err.message}`);
    }
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  private setStatus(status: ServerStatus): void {
    if (this._status !== status) {
      this._status = status;
      this._onStatusChange.fire(status);
    }
  }

  private getConfiguredPort(): number {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    return config.get<number>("mcpServerPort", 9181);
  }

  private getConfigPath(): string {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const relative = config.get<string>("configPath", ".code-intel/orchestration.json");
    return path.resolve(this.workspaceFolder, relative);
  }

  /**
   * Check if a port is already listening (TCP connect test).
   */
  private isPortListening(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000);
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.on("error", () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, "127.0.0.1");
    });
  }

  /**
   * Wait for the server to print its listening port on stderr.
   * Pattern: [mcp-http] Listening on port (\d+)
   */
  private waitForPort(child: ChildProcess, fallbackPort: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const portRegex = /\[mcp-http\] Listening on port (\d+)/;
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          // Timeout — assume configured port if process is still alive
          if (child.exitCode === null) {
            resolve(fallbackPort);
          } else {
            reject(new McpSpawnError("Server did not start within timeout."));
          }
        }
      }, SERVER_CONSTANTS.STARTUP_TIMEOUT_MS);

      const onData = (chunk: Buffer) => {
        if (resolved) {
          return;
        }
        const text = chunk.toString();
        this.outputChannel.appendLine(text.trimEnd());
        const match = portRegex.exec(text);
        if (match) {
          resolved = true;
          clearTimeout(timer);
          child.stderr?.removeListener("data", onData);
          resolve(parseInt(match[1], 10));
        }
      };

      child.stderr?.on("data", onData);

      child.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          reject(new McpSpawnError(err.message));
        }
      });

      child.on("exit", (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          reject(new McpSpawnError(`Server exited immediately with code ${code}`));
        }
      });
    });
  }

  /**
   * Write PID file to .code-intel/server.pid
   */
  private writePidFile(): void {
    if (!this._pid) {
      return;
    }
    try {
      const dir = path.join(this.workspaceFolder, ".code-intel");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(path.join(dir, "server.pid"), String(this._pid), "utf-8");
    } catch {
      // Non-critical
    }
  }

  /**
   * Remove PID file.
   */
  private removePidFile(): void {
    try {
      const pidPath = path.join(this.workspaceFolder, ".code-intel", "server.pid");
      if (fs.existsSync(pidPath)) {
        fs.unlinkSync(pidPath);
      }
    } catch {
      // Non-critical
    }
  }

  /**
   * Update .kiro/settings/mcp.json with the code-intelligence httpStream entry.
   */
  private updateMcpJson(): void {
    if (!this._port) {
      return;
    }
    try {
      const mcpDir = path.join(this.workspaceFolder, ".kiro", "settings");
      const mcpPath = path.join(mcpDir, "mcp.json");

      let config: Record<string, unknown> = {};
      if (fs.existsSync(mcpPath)) {
        config = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
      } else {
        if (!fs.existsSync(mcpDir)) {
          fs.mkdirSync(mcpDir, { recursive: true });
        }
      }

      const servers = (config.mcpServers as Record<string, unknown>) || {};
      const existing = (servers["code-intelligence"] as Record<string, unknown>) || {};
      servers["code-intelligence"] = {
        ...existing,
        type: "httpStream",
        url: `http://127.0.0.1:${this._port}/mcp`,
      };
      config.mcpServers = servers;

      fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2), "utf-8");
      this.outputChannel.appendLine(`[MCP] Updated mcp.json → http://127.0.0.1:${this._port}/mcp`);
    } catch (err) {
      this.outputChannel.appendLine(`[MCP] Warning: could not update mcp.json: ${(err as Error).message}`);
    }
  }
}

/**
 * Generate a cryptographic nonce for CSP script authorization.
 */
export function getNonce(): string {
  const array = crypto.randomBytes(16);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
