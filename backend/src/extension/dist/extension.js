"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode14 = __toESM(require("vscode"));

// src/config/ConfigurationManager.ts
var vscode = __toESM(require("vscode"));

// src/types/config.ts
var DEFAULT_BACKEND_CONFIG = {
  url: "http://127.0.0.1:48721",
  ssoEnabled: false,
  ssoProviderUrl: "",
  healthCheckInterval: 5e3,
  toolCallTimeout: 3e5,
  chatTimeout: 12e4
};

// src/config/ConfigurationManager.ts
var ConfigurationManager = class _ConfigurationManager {
  static SECTION = "codeIntel.backend";
  getConfiguration() {
    const vsConfig = vscode.workspace.getConfiguration(_ConfigurationManager.SECTION);
    return {
      url: vsConfig.get("url", DEFAULT_BACKEND_CONFIG.url),
      ssoEnabled: vsConfig.get("ssoEnabled", DEFAULT_BACKEND_CONFIG.ssoEnabled),
      ssoProviderUrl: vsConfig.get("ssoProviderUrl", DEFAULT_BACKEND_CONFIG.ssoProviderUrl),
      healthCheckInterval: vsConfig.get("healthCheckInterval", DEFAULT_BACKEND_CONFIG.healthCheckInterval),
      toolCallTimeout: vsConfig.get("toolCallTimeout", DEFAULT_BACKEND_CONFIG.toolCallTimeout),
      chatTimeout: vsConfig.get("chatTimeout", DEFAULT_BACKEND_CONFIG.chatTimeout)
    };
  }
  onConfigurationChanged(listener) {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(_ConfigurationManager.SECTION)) {
        listener(this.getConfiguration());
      }
    });
  }
  /**
   * Migrate legacy host+port settings to URL format (TDD §12.2).
   */
  async migrateIfNeeded() {
    const vsConfig = vscode.workspace.getConfiguration(_ConfigurationManager.SECTION);
    const hasLegacyHost = vsConfig.inspect("host")?.workspaceValue !== void 0 || vsConfig.inspect("host")?.globalValue !== void 0;
    const hasNewUrl = vsConfig.inspect("url")?.workspaceValue !== void 0 || vsConfig.inspect("url")?.globalValue !== void 0;
    if (hasLegacyHost && !hasNewUrl) {
      const host = vsConfig.get("host", "127.0.0.1");
      const port = vsConfig.get("port", 48721);
      const url = "http://" + host + ":" + port;
      await vsConfig.update("url", url, vscode.ConfigurationTarget.Global);
    }
  }
};

// src/connection/ConnectionManager.ts
var vscode2 = __toESM(require("vscode"));

// src/types/connection.ts
var DEFAULT_CONNECTION_CONFIG = {
  url: "http://127.0.0.1:48721",
  healthCheckInterval: 5e3,
  maxReconnectAttempts: 100,
  initialReconnectDelay: 1e3,
  maxReconnectDelay: 3e4
};
function createInitialState() {
  return {
    state: "DISCONNECTED",
    backendVersion: null,
    lastHealthCheck: 0,
    reconnectAttempts: 0,
    reconnectDelay: DEFAULT_CONNECTION_CONFIG.initialReconnectDelay,
    connectedAt: null
  };
}

// src/proxy/HttpClient.ts
var HttpClient = class {
  baseUrl;
  authManager;
  healthTimeout;
  toolCallTimeout;
  webviewTimeout;
  chatTimeout;
  uploadTimeout;
  constructor(config) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.authManager = config.authManager;
    this.healthTimeout = config.healthTimeout ?? 3e3;
    this.toolCallTimeout = config.toolCallTimeout ?? 3e5;
    this.webviewTimeout = config.webviewTimeout ?? 1e4;
    this.chatTimeout = config.chatTimeout ?? 12e4;
    this.uploadTimeout = config.uploadTimeout ?? 6e5;
  }
  get url() {
    return this.baseUrl;
  }
  async health() {
    const response = await this.doFetch("/health", {
      method: "GET",
      timeout: this.healthTimeout,
      skipAuth: true
      // health check doesn't need auth
    });
    return response.json();
  }
  async listTools() {
    const response = await this.doFetch("/mcp/tools/list", {
      method: "GET",
      timeout: this.toolCallTimeout
    });
    return response.json();
  }
  async callTool(request) {
    const response = await this.doFetch("/mcp/tools/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      timeout: this.toolCallTimeout
    });
    return response.json();
  }
  async fetchWebviewData(path2) {
    const response = await this.doFetch(path2, {
      method: "GET",
      timeout: this.webviewTimeout
    });
    const json = await response.json();
    return json.data;
  }
  async postWebviewData(path2, body) {
    const response = await this.doFetch(path2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeout: this.webviewTimeout
    });
    const json = await response.json();
    return json.data;
  }
  async post(path2, body) {
    const response = await this.doFetch(path2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeout: this.webviewTimeout
    });
    return response.json();
  }
  async postMultipart(path2, formData, _options) {
    const headers = await this.getAuthHeaders();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.uploadTimeout);
    try {
      const response = await fetch(this.baseUrl + path2, {
        method: "POST",
        headers,
        body: formData,
        signal: controller.signal
      });
      if (response.status === 401) {
        throw new AuthenticationRequiredError();
      }
      if (!response.ok) {
        throw new HttpError(response.status, await response.text());
      }
      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
  async streamChat(path2, body) {
    const headers = await this.getAuthHeaders();
    headers["Content-Type"] = "application/json";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.chatTimeout);
    try {
      const response = await fetch(this.baseUrl + path2, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (response.status === 401) {
        clearTimeout(timeoutId);
        throw new AuthenticationRequiredError();
      }
      if (!response.ok) {
        clearTimeout(timeoutId);
        throw new HttpError(response.status, await response.text());
      }
      if (!response.body) {
        clearTimeout(timeoutId);
        throw new HttpError(500, "No response body for streaming");
      }
      return response.body;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  async getAuthHeaders() {
    const token = await this.authManager.getAccessToken();
    const headers = {};
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }
    return headers;
  }
  async doFetch(path2, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);
    try {
      const authHeaders = options.skipAuth ? {} : await this.getAuthHeaders();
      const headers = { ...authHeaders, ...options.headers };
      const url = this.baseUrl + path2;
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body,
        signal: controller.signal
      });
      if (response.status === 401) {
        throw new AuthenticationRequiredError();
      }
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new RateLimitedError(retryAfter ? parseInt(retryAfter, 10) : 60);
      }
      if (!response.ok && response.status >= 500) {
        const errorBody = await response.text();
        throw new HttpError(response.status, errorBody);
      }
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
};
var HttpError = class extends Error {
  constructor(statusCode, body) {
    super("HTTP " + statusCode + ": " + body);
    this.statusCode = statusCode;
    this.body = body;
    this.name = "HttpError";
  }
};
var AuthenticationRequiredError = class extends Error {
  constructor() {
    super("Authentication required \u2014 token expired or invalid");
    this.name = "AuthenticationRequiredError";
  }
};
var RateLimitedError = class extends Error {
  constructor(retryAfterSeconds) {
    super("Rate limited \u2014 retry after " + retryAfterSeconds + "s");
    this.retryAfterSeconds = retryAfterSeconds;
    this.name = "RateLimitedError";
  }
};

// src/connection/HealthChecker.ts
var HealthChecker = class {
  intervalId = null;
  client;
  config;
  constructor(client, config) {
    this.client = client;
    this.config = config;
  }
  async checkOnce() {
    try {
      const response = await this.client.health();
      return { success: true, response };
    } catch (error) {
      return { success: false, error };
    }
  }
  startPolling(onResult) {
    this.stopPolling();
    this.intervalId = setInterval(async () => {
      const result = await this.checkOnce();
      onResult(result);
    }, this.config.healthCheckInterval);
  }
  stopPolling() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  dispose() {
    this.stopPolling();
  }
};

// src/connection/ConnectionManager.ts
var ConnectionManager = class {
  _state;
  stateChangeEmitter = new vscode2.EventEmitter();
  healthChecker;
  client;
  reconnectTimer = null;
  outputChannel;
  get state() {
    return { ...this._state };
  }
  constructor(config, authManager2, outputChannel) {
    this.outputChannel = outputChannel;
    this._state = createInitialState();
    this.client = new HttpClient({
      baseUrl: config.url,
      authManager: authManager2,
      healthTimeout: 3e3,
      toolCallTimeout: config.toolCallTimeout,
      webviewTimeout: 1e4,
      chatTimeout: config.chatTimeout
    });
    const connConfig = {
      url: config.url,
      healthCheckInterval: config.healthCheckInterval,
      maxReconnectAttempts: DEFAULT_CONNECTION_CONFIG.maxReconnectAttempts,
      initialReconnectDelay: DEFAULT_CONNECTION_CONFIG.initialReconnectDelay,
      maxReconnectDelay: DEFAULT_CONNECTION_CONFIG.maxReconnectDelay
    };
    this.healthChecker = new HealthChecker(this.client, connConfig);
  }
  async connect() {
    this.transitionTo("CONNECTING");
    const result = await this.healthChecker.checkOnce();
    if (result.success) {
      this.handleHealthSuccess(result.response);
      this.startHealthPolling();
    } else {
      this.transitionTo("DISCONNECTED");
      this.scheduleReconnect();
    }
  }
  disconnect() {
    this.healthChecker.stopPolling();
    this.cancelReconnect();
    this.transitionTo("DISCONNECTED");
    this._state.reconnectAttempts = 0;
    this._state.reconnectDelay = DEFAULT_CONNECTION_CONFIG.initialReconnectDelay;
  }
  onStateChange(listener) {
    return this.stateChangeEmitter.event(listener);
  }
  getHttpClient() {
    return this.client;
  }
  isConnected() {
    return this._state.state === "CONNECTED";
  }
  dispose() {
    this.disconnect();
    this.healthChecker.dispose();
    this.stateChangeEmitter.dispose();
  }
  startHealthPolling() {
    this.healthChecker.startPolling((result) => {
      if (result.success) {
        this._state.lastHealthCheck = Date.now();
        if (this._state.state !== "CONNECTED") {
          this.handleHealthSuccess(result.response);
        }
      } else {
        if (this._state.state === "CONNECTED") {
          this.log("Health check failed - Backend disconnected");
          this.transitionTo("DISCONNECTED");
          this.healthChecker.stopPolling();
          this.scheduleReconnect();
        }
      }
    });
  }
  handleHealthSuccess(response) {
    this._state.backendVersion = response.version;
    this._state.lastHealthCheck = Date.now();
    this._state.connectedAt = this._state.connectedAt ?? Date.now();
    this._state.reconnectAttempts = 0;
    this._state.reconnectDelay = DEFAULT_CONNECTION_CONFIG.initialReconnectDelay;
    this.transitionTo("CONNECTED");
    this.log("Connected to Backend v" + response.version + " (" + response.tools_loaded + " tools)");
  }
  scheduleReconnect() {
    if (this._state.reconnectAttempts >= DEFAULT_CONNECTION_CONFIG.maxReconnectAttempts) {
      this.log("Max reconnect attempts reached");
      return;
    }
    this.cancelReconnect();
    const delay = this._state.reconnectDelay;
    this.reconnectTimer = setTimeout(async () => {
      this._state.reconnectAttempts++;
      this._state.reconnectDelay = Math.min(
        this._state.reconnectDelay * 2,
        DEFAULT_CONNECTION_CONFIG.maxReconnectDelay
      );
      this.transitionTo("CONNECTING");
      const result = await this.healthChecker.checkOnce();
      if (result.success) {
        this.handleHealthSuccess(result.response);
        this.startHealthPolling();
      } else {
        this.transitionTo("DISCONNECTED");
        this.scheduleReconnect();
      }
    }, delay);
  }
  cancelReconnect() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  transitionTo(newState) {
    if (this._state.state === newState) return;
    const oldState = this._state.state;
    this._state.state = newState;
    if (newState === "DISCONNECTED") {
      this._state.connectedAt = null;
    }
    this.log("State: " + oldState + " -> " + newState);
    this.stateChangeEmitter.fire({ ...this._state });
  }
  log(message) {
    this.outputChannel.appendLine("[ConnectionManager] " + message);
  }
};

// src/proxy/ToolProxy.ts
var vscode4 = __toESM(require("vscode"));

// src/proxy/ToolRegistry.ts
var ToolRegistry = class {
  tools = /* @__PURE__ */ new Map();
  update(definitions) {
    for (const entry of this.tools.values()) {
      entry.registered = false;
    }
    for (const def of definitions) {
      this.tools.set(def.name, { ...def, registered: true });
    }
    for (const [name, entry] of this.tools) {
      if (!entry.registered) {
        this.tools.delete(name);
      }
    }
  }
  get(name) {
    return this.tools.get(name);
  }
  has(name) {
    return this.tools.has(name);
  }
  getAll() {
    return Array.from(this.tools.values());
  }
  getDefinitions() {
    return this.getAll().map(({ registered, ...def }) => def);
  }
  get size() {
    return this.tools.size;
  }
  clear() {
    this.tools.clear();
  }
};

// src/proxy/FileProxyHandler.ts
var vscode3 = __toESM(require("vscode"));
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var FILE_INPUT_TOOLS = /* @__PURE__ */ new Set([
  "mem_ingest_file",
  "drawio_auto_layout"
]);
var FILE_OUTPUT_TOOLS = /* @__PURE__ */ new Set([
  "stream_write_file"
]);
var FILE_BOTH_TOOLS = /* @__PURE__ */ new Set([
  "drawio_export_png",
  "export_docx"
]);
var EXTENSION_LOCAL_TOOLS = /* @__PURE__ */ new Set([
  "embed_images"
]);
var BINARY_EXTENSIONS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".webp",
  ".pdf",
  ".docx",
  ".xlsx",
  ".pptx",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".onnx",
  ".bin",
  ".dat",
  ".db",
  ".sqlite"
]);
var MAX_FILE_SIZE = 10 * 1024 * 1024;
var FileProxyHandler = class {
  workspaceRoot;
  outputChannel;
  constructor(outputChannel) {
    const folders = vscode3.workspace.workspaceFolders;
    this.workspaceRoot = folders?.[0]?.uri.fsPath ?? process.cwd();
    this.outputChannel = outputChannel;
  }
  /**
   * Detect tool pattern based on tool name classification.
   */
  getToolPattern(toolName) {
    if (EXTENSION_LOCAL_TOOLS.has(toolName)) return "extension-local";
    if (FILE_BOTH_TOOLS.has(toolName)) return "file-both";
    if (FILE_INPUT_TOOLS.has(toolName)) return "file-input";
    if (FILE_OUTPUT_TOOLS.has(toolName)) return "file-output";
    return "text-only";
  }
  /**
   * Pattern 1 and 3 (Both): If tool needs file input, read file and inject content.
   * Returns enriched args with __file_content and __file_encoding.
   * Throws error if file not found or exceeds size limit.
   */
  async enrichWithFileContent(toolName, args) {
    const pattern = this.getToolPattern(toolName);
    if (pattern === "text-only" || pattern === "file-output") {
      return args;
    }
    const filePath = args.file_path;
    if (!filePath) {
      return args;
    }
    const absolutePath = this.resolveRelativePath(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new FileProxyError(
        "FILE_NOT_FOUND",
        "File not found: " + filePath
      );
    }
    const stats = fs.statSync(absolutePath);
    if (stats.size > MAX_FILE_SIZE) {
      const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
      throw new FileProxyError(
        "FILE_TOO_LARGE",
        "File exceeds 10MB limit (" + sizeMB + "MB): " + filePath + ". Chunk upload not yet supported."
      );
    }
    const isBinary = this.isBinaryFile(absolutePath);
    const content = fs.readFileSync(absolutePath);
    const encoding = isBinary ? "base64" : "utf-8";
    const encodedContent = isBinary ? content.toString("base64") : content.toString("utf-8");
    this.log("File input: " + filePath + " (" + (stats.size / 1024).toFixed(1) + "KB, " + encoding + ")");
    return {
      ...args,
      __file_content: encodedContent,
      __file_encoding: encoding
    };
  }
  /**
   * Pattern 2 and 3 (Both): If response contains __file_output, write file to workspace.
   */
  async handleFileOutput(response) {
    if (!response.__file_output) {
      return;
    }
    const { path: relativePath, data, encoding } = response.__file_output;
    if (!relativePath || !data) {
      this.log("Warning: __file_output missing path or data");
      return;
    }
    const absolutePath = this.resolveRelativePath(relativePath);
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const buffer = encoding === "base64" ? Buffer.from(data, "base64") : Buffer.from(data, "utf-8");
    fs.writeFileSync(absolutePath, buffer);
    this.log("File output: " + relativePath + " (" + (buffer.length / 1024).toFixed(1) + "KB written)");
  }
  /**
   * Resolve relative path from workspace root to absolute path.
   * Prevents path traversal attacks.
   */
  resolveRelativePath(relativePath) {
    const normalized = path.normalize(relativePath);
    const absolute = path.resolve(this.workspaceRoot, normalized);
    if (!absolute.startsWith(this.workspaceRoot)) {
      throw new FileProxyError(
        "PATH_TRAVERSAL",
        "Path traversal detected: " + relativePath
      );
    }
    return absolute;
  }
  /**
   * Detect if file is binary based on extension.
   */
  isBinaryFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return BINARY_EXTENSIONS.has(ext);
  }
  log(message) {
    this.outputChannel.appendLine("[FileProxyHandler] " + message);
  }
};
var FileProxyError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "FileProxyError";
  }
};

// src/proxy/ToolProxy.ts
var LOCAL_TOOLS = /* @__PURE__ */ new Set(["embed_images"]);
var ToolProxy = class {
  registry;
  connectionManager;
  fileProxy;
  disposables = [];
  outputChannel;
  constructor(connectionManager2, outputChannel) {
    this.connectionManager = connectionManager2;
    this.outputChannel = outputChannel;
    this.registry = new ToolRegistry();
    this.fileProxy = new FileProxyHandler(outputChannel);
  }
  async registerTools(tools) {
    this.registry.update(tools);
    for (const tool of tools) {
      try {
        const disposable = vscode4.lm.registerTool(tool.name, {
          invoke: async (_options, _token) => {
            const args = _options.input ?? {};
            const result = await this.callTool(tool.name, args);
            return new vscode4.LanguageModelToolResult(
              result.content.map((block) => {
                if (block.type === "text") {
                  return new vscode4.LanguageModelTextPart(block.text ?? "");
                }
                return new vscode4.LanguageModelTextPart(JSON.stringify(block));
              })
            );
          },
          prepareInvocation: async (_options, _token) => {
            return {
              invocationMessage: "Calling " + tool.name + "..."
            };
          }
        });
        this.disposables.push(disposable);
      } catch (error) {
        this.log("Failed to register tool " + tool.name + ": " + error.message);
      }
    }
    this.log("Registered " + tools.length + " tools");
  }
  async callTool(name, args) {
    if (LOCAL_TOOLS.has(name)) {
      return this.executeLocalTool(name, args);
    }
    if (!this.connectionManager.isConnected()) {
      return this.errorResult("BACKEND_UNAVAILABLE", "Backend is not connected");
    }
    if (!this.registry.has(name)) {
      return this.errorResult("TOOL_NOT_FOUND", "Tool '" + name + "' not found");
    }
    try {
      const enrichedArgs = await this.fileProxy.enrichWithFileContent(name, args);
      const client = this.connectionManager.getHttpClient();
      const result = await client.callTool({ tool_name: name, arguments: enrichedArgs });
      await this.fileProxy.handleFileOutput(result);
      if (result.__file_output) {
        delete result.__file_output;
      }
      return result;
    } catch (error) {
      if (error instanceof FileProxyError) {
        return this.errorResult(error.code, error.message);
      }
      if (error instanceof AuthenticationRequiredError) {
        return this.errorResult("AUTH_REQUIRED", "Authentication required \u2014 please login");
      }
      if (error instanceof RateLimitedError) {
        return this.errorResult("RATE_LIMITED", "Rate limited \u2014 retry after " + error.retryAfterSeconds + "s");
      }
      if (error instanceof HttpError) {
        return this.errorResult("INTERNAL_ERROR", "Tool execution failed: " + error.body);
      }
      if (error.name === "AbortError") {
        return this.errorResult("TIMEOUT", "Tool call timed out");
      }
      return this.errorResult("BACKEND_UNAVAILABLE", "Backend is not responding: " + error.message);
    }
  }
  getRegisteredTools() {
    return this.registry.getDefinitions();
  }
  async refreshTools() {
    if (!this.connectionManager.isConnected()) return;
    try {
      const client = this.connectionManager.getHttpClient();
      const response = await client.listTools();
      await this.registerTools(response.tools);
    } catch (error) {
      this.log("Failed to refresh tools: " + error.message);
    }
  }
  dispose() {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
    this.registry.clear();
  }
  async executeLocalTool(name, args) {
    try {
      if (name === "embed_images") {
        const result = await this.fileProxy.enrichWithFileContent(name, args);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          isError: false
        };
      }
      return this.errorResult("TOOL_NOT_FOUND", "Local tool '" + name + "' not implemented");
    } catch (error) {
      if (error instanceof FileProxyError) {
        return this.errorResult(error.code, error.message);
      }
      return this.errorResult("LOCAL_TOOL_ERROR", error.message);
    }
  }
  errorResult(code, message) {
    return {
      content: [{ type: "text", text: "Error [" + code + "]: " + message }],
      isError: true
    };
  }
  log(message) {
    this.outputChannel.appendLine("[ToolProxy] " + message);
  }
};

// src/webview/WebviewManager.ts
var vscode5 = __toESM(require("vscode"));

// src/webview/WebviewDataFetcher.ts
var WebviewDataFetcher = class {
  connectionManager;
  constructor(connectionManager2) {
    this.connectionManager = connectionManager2;
  }
  async fetch(path2) {
    if (!this.connectionManager.isConnected()) {
      return null;
    }
    try {
      const client = this.connectionManager.getHttpClient();
      return await client.fetchWebviewData(path2);
    } catch {
      return null;
    }
  }
  async post(path2, body) {
    if (!this.connectionManager.isConnected()) {
      return null;
    }
    try {
      const client = this.connectionManager.getHttpClient();
      return await client.postWebviewData(path2, body);
    } catch {
      return null;
    }
  }
};

// src/webview/WebviewManager.ts
var PANEL_CONFIGS = {
  dashboard: { title: "Dashboard", viewType: "codeIntel.dashboard", dataEndpoint: "/api/dashboard/summary" },
  kbGraph: { title: "KB Graph", viewType: "codeIntel.kbGraph", dataEndpoint: "/api/kb/graph" },
  analytics: { title: "Analytics", viewType: "codeIntel.analytics", dataEndpoint: "/api/analytics/overview" },
  tags: { title: "Tags", viewType: "codeIntel.tags", dataEndpoint: "/api/tags/list" },
  quality: { title: "Quality", viewType: "codeIntel.quality", dataEndpoint: "/api/quality/summary" },
  chat: { title: "Chat", viewType: "codeIntel.chat", dataEndpoint: "/api/chat/history" }
};
var WebviewManager = class {
  panels = /* @__PURE__ */ new Map();
  dataFetcher;
  extensionUri;
  disposables = [];
  constructor(connectionManager2, extensionUri) {
    this.dataFetcher = new WebviewDataFetcher(connectionManager2);
    this.extensionUri = extensionUri;
    const stateDisposable = connectionManager2.onStateChange((state) => {
      if (state.state === "CONNECTED") {
        this.refreshAllPanels();
      }
    });
    this.disposables.push(stateDisposable);
  }
  openPanel(panelId) {
    if (panelId === "chat") return;
    const existing = this.panels.get(panelId);
    if (existing) {
      existing.reveal();
      this.refreshPanel(panelId);
      return;
    }
    const config = PANEL_CONFIGS[panelId];
    const panel = vscode5.window.createWebviewPanel(
      config.viewType,
      config.title,
      vscode5.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri]
      }
    );
    panel.onDidDispose(() => {
      this.panels.delete(panelId);
    });
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "refresh") {
        await this.refreshPanel(panelId);
      } else if (message.type === "fetch") {
        const data = await this.dataFetcher.fetch(message.path);
        panel.webview.postMessage({ type: "data", id: message.id, data });
      } else if (message.type === "post") {
        const data = await this.dataFetcher.post(message.path, message.body);
        panel.webview.postMessage({ type: "data", id: message.id, data });
      }
    });
    this.panels.set(panelId, panel);
    panel.webview.html = this.getWebviewHtml(panelId);
    this.refreshPanel(panelId);
  }
  closePanel(panelId) {
    const panel = this.panels.get(panelId);
    if (panel) {
      panel.dispose();
      this.panels.delete(panelId);
    }
  }
  async refreshPanel(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel) return;
    const config = PANEL_CONFIGS[panelId];
    const data = await this.dataFetcher.fetch(config.dataEndpoint);
    panel.webview.postMessage({ type: "update", data });
  }
  refreshAllPanels() {
    for (const panelId of this.panels.keys()) {
      this.refreshPanel(panelId);
    }
  }
  getWebviewHtml(panelId) {
    const config = PANEL_CONFIGS[panelId];
    return [
      "<!DOCTYPE html>",
      '<html lang="en">',
      "<head>",
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      "  <title>" + config.title + "</title>",
      "  <style>",
      "    body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); }",
      "    .loading { text-align: center; padding: 40px; opacity: 0.7; }",
      "    .error { color: var(--vscode-errorForeground); padding: 16px; }",
      "  </style>",
      "</head>",
      "<body>",
      '  <div id="root"><div class="loading">Loading ' + config.title + "...</div></div>",
      "  <script>",
      "    const vscode = acquireVsCodeApi();",
      '    window.addEventListener("message", (event) => {',
      "      const msg = event.data;",
      '      if (msg.type === "update") {',
      '        document.getElementById("root").innerHTML = msg.data',
      '          ? "<pre>" + JSON.stringify(msg.data, null, 2) + "</pre>"',
      '          : "<div class=\\"error\\">Backend offline</div>";',
      "      }",
      "    });",
      "  </script>",
      "</body>",
      "</html>"
    ].join("\n");
  }
  dispose() {
    for (const panel of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
};

// src/ui/StatusBarManager.ts
var vscode6 = __toESM(require("vscode"));
var StatusBarManager = class {
  statusBarItem;
  constructor() {
    this.statusBarItem = vscode6.window.createStatusBarItem(
      vscode6.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = "codeIntel.showConnectionStatus";
    this.updateState({
      state: "DISCONNECTED",
      backendVersion: null,
      lastHealthCheck: 0,
      reconnectAttempts: 0,
      reconnectDelay: 1e3,
      connectedAt: null
    });
    this.statusBarItem.show();
  }
  updateState(state) {
    switch (state.state) {
      case "CONNECTED":
        this.statusBarItem.text = "$(check) Code Intel";
        this.statusBarItem.backgroundColor = void 0;
        this.statusBarItem.tooltip = "Backend v" + (state.backendVersion ?? "unknown") + " - Connected";
        break;
      case "CONNECTING":
        this.statusBarItem.text = "$(sync~spin) Code Intel";
        this.statusBarItem.backgroundColor = void 0;
        this.statusBarItem.tooltip = "Connecting to Backend...";
        break;
      case "DISCONNECTED":
        this.statusBarItem.text = "$(error) Code Intel";
        this.statusBarItem.backgroundColor = new vscode6.ThemeColor("statusBarItem.errorBackground");
        this.statusBarItem.tooltip = state.reconnectAttempts > 0 ? "Backend Disconnected (retry " + state.reconnectAttempts + ")" : "Backend Disconnected";
        break;
    }
  }
  dispose() {
    this.statusBarItem.dispose();
  }
};

// src/ui/NotificationManager.ts
var vscode7 = __toESM(require("vscode"));
var NotificationManager = class {
  showError(message, ...actions) {
    return vscode7.window.showErrorMessage("Code Intel: " + message, ...actions);
  }
  showWarning(message, ...actions) {
    return vscode7.window.showWarningMessage("Code Intel: " + message, ...actions);
  }
  showInfo(message) {
    return vscode7.window.showInformationMessage("Code Intel: " + message);
  }
};

// src/auth/AuthManager.ts
var vscode8 = __toESM(require("vscode"));
var SECRET_KEY_ACCESS = "codeIntel.auth.accessToken";
var SECRET_KEY_REFRESH = "codeIntel.auth.refreshToken";
var SECRET_KEY_EXPIRES = "codeIntel.auth.expiresAt";
var SECRET_KEY_USER = "codeIntel.auth.user";
var AuthManager = class {
  constructor(secrets) {
    this.secrets = secrets;
  }
  _state = "UNAUTHENTICATED";
  _user = null;
  _onStateChange = new vscode8.EventEmitter();
  onStateChange = this._onStateChange.event;
  get state() {
    return this._state;
  }
  get user() {
    return this._user;
  }
  get isAuthenticated() {
    return this._state === "AUTHENTICATED";
  }
  /**
   * Initialize — check SecretStorage for existing tokens (UC-1 AF-1).
   */
  async initialize() {
    const accessToken = await this.secrets.get(SECRET_KEY_ACCESS);
    const expiresAtStr = await this.secrets.get(SECRET_KEY_EXPIRES);
    if (accessToken && expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      if (expiresAt > Date.now()) {
        const userJson = await this.secrets.get(SECRET_KEY_USER);
        if (userJson) {
          this._user = JSON.parse(userJson);
        }
        this.setState("AUTHENTICATED");
        return;
      }
    }
    const refreshToken = await this.secrets.get(SECRET_KEY_REFRESH);
    if (refreshToken) {
      this.setState("REFRESHING");
    } else {
      this.setState("UNAUTHENTICATED");
    }
  }
  /**
   * Store tokens after successful login.
   */
  async storeLoginResult(response) {
    const expiresAt = Date.now() + response.expires_in * 1e3;
    await this.secrets.store(SECRET_KEY_ACCESS, response.access_token);
    await this.secrets.store(SECRET_KEY_REFRESH, response.refresh_token);
    await this.secrets.store(SECRET_KEY_EXPIRES, expiresAt.toString());
    this._user = {
      id: response.user.id,
      username: response.user.username,
      email: response.user.email,
      display_name: response.user.display_name,
      role: response.user.role,
      projects: response.user.projects,
      auth_method: "local"
    };
    await this.secrets.store(SECRET_KEY_USER, JSON.stringify(this._user));
    this.setState("AUTHENTICATED");
  }
  /**
   * Store new tokens after refresh.
   */
  async storeRefreshResult(accessToken, refreshToken, expiresIn) {
    const expiresAt = Date.now() + expiresIn * 1e3;
    await this.secrets.store(SECRET_KEY_ACCESS, accessToken);
    await this.secrets.store(SECRET_KEY_REFRESH, refreshToken);
    await this.secrets.store(SECRET_KEY_EXPIRES, expiresAt.toString());
    this.setState("AUTHENTICATED");
  }
  /**
   * Get stored tokens for HTTP requests.
   */
  async getStoredTokens() {
    const accessToken = await this.secrets.get(SECRET_KEY_ACCESS);
    const refreshToken = await this.secrets.get(SECRET_KEY_REFRESH);
    const expiresAtStr = await this.secrets.get(SECRET_KEY_EXPIRES);
    if (!accessToken || !refreshToken || !expiresAtStr) return null;
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: parseInt(expiresAtStr, 10)
    };
  }
  /**
   * Get current access token.
   */
  async getAccessToken() {
    return await this.secrets.get(SECRET_KEY_ACCESS) ?? null;
  }
  /**
   * Get refresh token for renewal.
   */
  async getRefreshToken() {
    return await this.secrets.get(SECRET_KEY_REFRESH) ?? null;
  }
  /**
   * Clear all auth state (logout). Implements UC-10.
   */
  async clearTokens() {
    await this.secrets.delete(SECRET_KEY_ACCESS);
    await this.secrets.delete(SECRET_KEY_REFRESH);
    await this.secrets.delete(SECRET_KEY_EXPIRES);
    await this.secrets.delete(SECRET_KEY_USER);
    this._user = null;
    this.setState("UNAUTHENTICATED");
  }
  /**
   * Mark as authenticating (during login flow).
   */
  setAuthenticating() {
    this.setState("AUTHENTICATING");
  }
  /**
   * Mark as refreshing (during token refresh).
   */
  setRefreshing() {
    this.setState("REFRESHING");
  }
  /**
   * Mark as unauthenticated (on 401 or refresh failure).
   */
  setUnauthenticated() {
    this.setState("UNAUTHENTICATED");
  }
  setState(state) {
    if (this._state !== state) {
      this._state = state;
      this._onStateChange.fire(state);
    }
  }
  dispose() {
    this._onStateChange.dispose();
  }
};

// src/auth/TokenRefreshTimer.ts
var REFRESH_BUFFER_MS = 5 * 60 * 1e3;
var RETRY_DELAY_MS = 3e4;
var TokenRefreshTimer = class {
  constructor(authManager2, baseUrl) {
    this.authManager = authManager2;
    this.baseUrl = baseUrl;
  }
  timer = null;
  baseUrl;
  /**
   * Start the refresh timer based on current token expiry.
   */
  async start() {
    this.stop();
    const tokens = await this.authManager.getStoredTokens();
    if (!tokens) return;
    const now = Date.now();
    const refreshAt = tokens.expires_at - REFRESH_BUFFER_MS;
    const delay = Math.max(refreshAt - now, 1e3);
    this.timer = setTimeout(() => this.doRefresh(), delay);
  }
  /**
   * Stop the refresh timer.
   */
  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
  /**
   * Execute token refresh.
   */
  async doRefresh() {
    const refreshToken = await this.authManager.getRefreshToken();
    if (!refreshToken) {
      this.authManager.setUnauthenticated();
      return;
    }
    this.authManager.setRefreshing();
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      if (!response.ok) {
        this.timer = setTimeout(async () => {
          await this.retryRefresh(refreshToken);
        }, RETRY_DELAY_MS);
        return;
      }
      const data = await response.json();
      await this.authManager.storeRefreshResult(
        data.access_token,
        data.refresh_token,
        data.expires_in
      );
      await this.start();
    } catch {
      this.timer = setTimeout(async () => {
        await this.retryRefresh(refreshToken);
      }, RETRY_DELAY_MS);
    }
  }
  async retryRefresh(refreshToken) {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      if (!response.ok) {
        await this.authManager.clearTokens();
        return;
      }
      const data = await response.json();
      await this.authManager.storeRefreshResult(
        data.access_token,
        data.refresh_token,
        data.expires_in
      );
      await this.start();
    } catch {
      await this.authManager.clearTokens();
    }
  }
  dispose() {
    this.stop();
  }
};

// src/webview/panels/LoginPanel.ts
var vscode9 = __toESM(require("vscode"));
var LoginPanel = class {
  constructor(authManager2, extensionUri, baseUrl) {
    this.authManager = authManager2;
    this.extensionUri = extensionUri;
    this.baseUrl = baseUrl;
  }
  panel = null;
  baseUrl;
  disposables = [];
  /**
   * Show the Login Webview panel.
   */
  show() {
    if (this.panel) {
      this.panel.reveal();
      return;
    }
    this.panel = vscode9.window.createWebviewPanel(
      "codeIntel.login",
      "Code Intelligence \u2014 Login",
      vscode9.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [this.extensionUri]
      }
    );
    this.panel.webview.html = this.getHtml();
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case "login":
            await this.handleLogin(message.username, message.password);
            break;
          case "sso":
            await this.handleSso();
            break;
        }
      },
      null,
      this.disposables
    );
    this.panel.onDidDispose(() => {
      this.panel = null;
    }, null, this.disposables);
  }
  /**
   * Close the Login panel.
   */
  close() {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
  }
  async handleLogin(username, password) {
    this.authManager.setAuthenticating();
    this.postMessage({ type: "loading", loading: true });
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!response.ok) {
        const errorData = await response.json();
        this.postMessage({
          type: "error",
          message: errorData.error.message
        });
        this.authManager.setUnauthenticated();
        return;
      }
      const raw = await response.json();
      const data = {
        access_token: raw.token || raw.access_token,
        refresh_token: raw.refresh_token || raw.token,
        // backend may not have refresh
        token_type: "Bearer",
        expires_in: raw.expiresAt ? Math.floor((new Date(raw.expiresAt).getTime() - Date.now()) / 1e3) : 3600,
        user: {
          id: raw.user?.userId || raw.user?.id || "",
          username: raw.user?.username || "",
          email: raw.user?.email || "",
          display_name: raw.user?.display_name || null,
          role: raw.user?.permissions?.includes("ADMIN") ? "admin" : "user",
          projects: raw.user?.projects || []
        }
      };
      await this.authManager.storeLoginResult(data);
      this.close();
    } catch {
      this.postMessage({
        type: "error",
        message: "Cannot connect to Backend. Please ensure the server is running."
      });
      this.authManager.setUnauthenticated();
    }
  }
  async handleSso() {
    vscode9.window.showInformationMessage("SSO login: Opening browser...");
  }
  postMessage(message) {
    this.panel?.webview.postMessage(message);
  }
  getHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 40px 20px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      display: flex;
      justify-content: center;
    }
    .container {
      max-width: 360px;
      width: 100%;
    }
    h1 {
      font-size: 1.4em;
      margin-bottom: 24px;
      text-align: center;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      margin-bottom: 4px;
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
    }
    input {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 12px;
      font-size: 1em;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
    }
    input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }
    .btn {
      width: 100%;
      padding: 10px;
      font-size: 1em;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 8px;
    }
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .error-msg {
      color: var(--vscode-errorForeground);
      font-size: 0.85em;
      margin-top: 12px;
      text-align: center;
      display: none;
    }
    .divider {
      text-align: center;
      margin: 20px 0;
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Code Intelligence</h1>
    <form id="loginForm">
      <div class="form-group">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" autocomplete="username" required />
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" autocomplete="current-password" required />
      </div>
      <button type="submit" class="btn btn-primary" id="loginBtn">Login</button>
    </form>
    <div class="error-msg" id="errorMsg"></div>
    <div class="divider">\u2014 or \u2014</div>
    <button class="btn btn-secondary" id="ssoBtn">Login with SSO</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const form = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const ssoBtn = document.getElementById('ssoBtn');
    const errorMsg = document.getElementById('errorMsg');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      if (!username || !password) return;
      vscode.postMessage({ type: 'login', username, password });
    });

    ssoBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'sso' });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'loading') {
        loginBtn.disabled = msg.loading;
        loginBtn.textContent = msg.loading ? 'Logging in...' : 'Login';
      } else if (msg.type === 'error') {
        errorMsg.style.display = 'block';
        errorMsg.textContent = msg.message;
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
      }
    });
  </script>
</body>
</html>`;
  }
  dispose() {
    this.close();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
};

// src/webview/panels/McpConfigPanel.ts
var vscode10 = __toESM(require("vscode"));

// src/auth/AuthInterceptor.ts
var AuthInterceptor = class {
  constructor(authManager2) {
    this.authManager = authManager2;
  }
  /**
   * Get headers with Bearer token for authenticated requests.
   * Returns empty object if not authenticated.
   */
  async getAuthHeaders() {
    if (!this.authManager.isAuthenticated) {
      return {};
    }
    const token = await this.authManager.getAccessToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }
  /**
   * Inject auth headers into existing headers map.
   */
  async injectHeaders(headers = {}) {
    const authHeaders = await this.getAuthHeaders();
    return { ...headers, ...authHeaders };
  }
  /**
   * Check if a response indicates auth failure (401).
   * If so, trigger unauthenticated state.
   */
  handleAuthError(statusCode) {
    if (statusCode === 401) {
      this.authManager.setUnauthenticated();
      return true;
    }
    return false;
  }
};

// src/webview/panels/McpConfigPanel.ts
var McpConfigPanel = class {
  constructor(authManager2, extensionUri, baseUrl) {
    this.extensionUri = extensionUri;
    this.baseUrl = baseUrl;
    this.authInterceptor = new AuthInterceptor(authManager2);
  }
  panel = null;
  baseUrl;
  authInterceptor;
  disposables = [];
  show() {
    if (this.panel) {
      this.panel.reveal();
      return;
    }
    this.panel = vscode10.window.createWebviewPanel(
      "codeIntel.mcpConfig",
      "MCP Server Configuration",
      vscode10.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri]
      }
    );
    this.panel.webview.html = this.getHtml();
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case "load":
            await this.handleLoad();
            break;
          case "save":
            await this.handleSave(message.config);
            break;
          case "test":
            await this.handleTest(message.server);
            break;
        }
      },
      null,
      this.disposables
    );
    this.panel.onDidDispose(() => {
      this.panel = null;
    }, null, this.disposables);
    setTimeout(() => this.handleLoad(), 100);
  }
  close() {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
  }
  async handleLoad() {
    try {
      const headers = await this.authInterceptor.injectHeaders({ "Content-Type": "application/json" });
      const response = await fetch(`${this.baseUrl}/api/config/mcp-servers`, { headers });
      if (!response.ok) {
        this.postMessage({ type: "error", message: "Failed to load configuration." });
        return;
      }
      const data = await response.json();
      this.postMessage({ type: "loaded", config: data });
    } catch {
      this.postMessage({ type: "error", message: "Backend unavailable." });
    }
  }
  async handleSave(config) {
    try {
      const headers = await this.authInterceptor.injectHeaders({ "Content-Type": "application/json" });
      const response = await fetch(`${this.baseUrl}/api/config/mcp-servers`, {
        method: "PUT",
        headers,
        body: JSON.stringify(config)
      });
      if (!response.ok) {
        const err = await response.json();
        this.postMessage({ type: "saveResult", success: false, message: err?.error?.message ?? "Save failed." });
        return;
      }
      this.postMessage({ type: "saveResult", success: true, message: "Configuration saved successfully." });
    } catch {
      this.postMessage({ type: "saveResult", success: false, message: "Backend unavailable." });
    }
  }
  async handleTest(server) {
    try {
      const headers = await this.authInterceptor.injectHeaders({ "Content-Type": "application/json" });
      const response = await fetch(`${this.baseUrl}/api/config/mcp-servers/test`, {
        method: "POST",
        headers,
        body: JSON.stringify({ server })
      });
      const data = await response.json();
      this.postMessage({ type: "testResult", server, ...data });
    } catch {
      this.postMessage({ type: "testResult", server, status: "failed", message: "Backend unavailable." });
    }
  }
  postMessage(message) {
    this.panel?.webview.postMessage(message);
  }
  getHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Configuration</title>
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
    h1 { font-size: 1.3em; margin-bottom: 20px; }
    .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 20px; }
    .tab { padding: 8px 16px; cursor: pointer; border: none; background: none; color: var(--vscode-foreground); opacity: 0.7; border-bottom: 2px solid transparent; }
    .tab.active { opacity: 1; border-bottom-color: var(--vscode-focusBorder); }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .form-group { margin-bottom: 14px; }
    label { display: block; margin-bottom: 4px; font-size: 0.9em; color: var(--vscode-descriptionForeground); }
    input { width: 100%; box-sizing: border-box; padding: 6px 10px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 3px; }
    .btn { padding: 8px 16px; border: none; border-radius: 3px; cursor: pointer; margin-right: 8px; margin-top: 10px; }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .status { margin-top: 12px; font-size: 0.85em; padding: 8px; border-radius: 3px; }
    .status.success { background: rgba(0,200,0,0.1); color: var(--vscode-testing-iconPassed); }
    .status.error { background: rgba(200,0,0,0.1); color: var(--vscode-errorForeground); }
  </style>
</head>
<body>
  <h1>MCP Server Configuration</h1>
  <div class="tabs">
    <button class="tab active" data-tab="jira">Jira</button>
    <button class="tab" data-tab="drawio">DrawIO</button>
    <button class="tab" data-tab="export">Export</button>
  </div>

  <div class="tab-content active" id="tab-jira">
    <div class="form-group"><label>URL</label><input id="jira-url" placeholder="https://company.atlassian.net" /></div>
    <div class="form-group"><label>Username / Email</label><input id="jira-username" placeholder="john@company.com" /></div>
    <div class="form-group"><label>API Token</label><input id="jira-token" type="password" placeholder="Enter API token" /></div>
    <div class="form-group"><label>Project Key (optional)</label><input id="jira-project" placeholder="KSA" /></div>
    <button class="btn btn-secondary" onclick="testConnection('jira')">Test Connection</button>
  </div>

  <div class="tab-content" id="tab-drawio">
    <div class="form-group"><label>draw.io CLI Path</label><input id="drawio-path" placeholder="C:\\Program Files\\draw.io\\draw.io.exe" /></div>
    <div class="form-group"><label>Export Format</label><input id="drawio-format" placeholder="png" value="png" /></div>
  </div>

  <div class="tab-content" id="tab-export">
    <div class="form-group"><label>Output Directory</label><input id="export-dir" placeholder="./documents" /></div>
  </div>

  <div style="margin-top: 20px;">
    <button class="btn btn-primary" onclick="saveConfig()">Save All</button>
  </div>
  <div class="status" id="statusMsg" style="display:none;"></div>

  <script>
    const vscode = acquireVsCodeApi();

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });

    function saveConfig() {
      const config = {};
      const jiraUrl = document.getElementById('jira-url').value.trim();
      const jiraUser = document.getElementById('jira-username').value.trim();
      const jiraToken = document.getElementById('jira-token').value;
      if (jiraUrl || jiraUser) {
        config.jira = { url: jiraUrl, username: jiraUser };
        if (jiraToken) config.jira.token = jiraToken;
        const pk = document.getElementById('jira-project').value.trim();
        if (pk) config.jira.project_key = pk;
      }
      const drawioPath = document.getElementById('drawio-path').value.trim();
      const drawioFmt = document.getElementById('drawio-format').value.trim();
      if (drawioPath || drawioFmt) config.drawio = { path: drawioPath || undefined, format: drawioFmt || undefined };
      const exportDir = document.getElementById('export-dir').value.trim();
      if (exportDir) config.export = { output_dir: exportDir };
      vscode.postMessage({ type: 'save', config });
    }

    function testConnection(server) {
      vscode.postMessage({ type: 'test', server });
    }

    // Load config on init
    vscode.postMessage({ type: 'load' });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      const statusEl = document.getElementById('statusMsg');
      if (msg.type === 'loaded' && msg.config) {
        const s = msg.config.servers || {};
        if (s.jira) {
          document.getElementById('jira-url').value = s.jira.url || '';
          document.getElementById('jira-username').value = s.jira.username || '';
          if (s.jira.project_key) document.getElementById('jira-project').value = s.jira.project_key;
          if (s.jira.token_configured) document.getElementById('jira-token').placeholder = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
        }
        if (s.drawio) {
          if (s.drawio.path) document.getElementById('drawio-path').value = s.drawio.path;
          if (s.drawio.format) document.getElementById('drawio-format').value = s.drawio.format;
        }
        if (s.export && s.export.output_dir) {
          document.getElementById('export-dir').value = s.export.output_dir;
        }
      } else if (msg.type === 'saveResult') {
        statusEl.style.display = 'block';
        statusEl.className = 'status ' + (msg.success ? 'success' : 'error');
        statusEl.textContent = msg.message;
      } else if (msg.type === 'testResult') {
        statusEl.style.display = 'block';
        statusEl.className = 'status ' + (msg.status === 'success' ? 'success' : 'error');
        statusEl.textContent = msg.server + ': ' + msg.message;
      } else if (msg.type === 'error') {
        statusEl.style.display = 'block';
        statusEl.className = 'status error';
        statusEl.textContent = msg.message;
      }
    });
  </script>
</body>
</html>`;
  }
  dispose() {
    this.close();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
};

// src/webview/panels/ChatPanel.ts
var vscode11 = __toESM(require("vscode"));
var ChatPanel = class {
  panel = null;
  extensionUri;
  client;
  authManager;
  outputChannel;
  sessionId = null;
  messages = [];
  constructor(client, authManager2, extensionUri, outputChannel) {
    this.client = client;
    this.authManager = authManager2;
    this.extensionUri = extensionUri;
    this.outputChannel = outputChannel;
  }
  show() {
    if (this.panel) {
      this.panel.reveal();
      return;
    }
    this.panel = vscode11.window.createWebviewPanel(
      "codeIntel.chat",
      "Code Intel Chat",
      vscode11.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri]
      }
    );
    this.panel.onDidDispose(() => {
      this.panel = null;
    });
    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "sendMessage":
          await this.handleSendMessage(message.text, message.context ?? []);
          break;
        case "newSession":
          this.sessionId = null;
          this.messages = [];
          break;
      }
    });
    this.panel.webview.html = this.getHtml();
  }
  close() {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
  }
  async handleSendMessage(text, context) {
    if (!this.authManager.isAuthenticated) {
      this.postToWebview({ type: "error", message: "Please login first" });
      return;
    }
    this.messages.push({ role: "user", content: text, timestamp: Date.now() });
    this.postToWebview({ type: "chat:userMessage", content: text });
    try {
      const body = {
        message: text,
        context,
        session_id: this.sessionId
      };
      const stream = await this.client.streamChat("/api/chat", body);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      this.postToWebview({ type: "chat:start" });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        this.postToWebview({ type: "chat:chunk", content: chunk });
      }
      this.postToWebview({ type: "chat:end" });
      this.messages.push({ role: "assistant", content: fullResponse, timestamp: Date.now() });
    } catch (error) {
      const msg = error.message;
      this.log("Chat error: " + msg);
      this.postToWebview({ type: "error", message: "Chat failed: " + msg });
    }
  }
  postToWebview(message) {
    this.panel?.webview.postMessage(message);
  }
  getHtml() {
    return [
      "<!DOCTYPE html>",
      '<html lang="en">',
      "<head>",
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      "  <title>Code Intel Chat</title>",
      "  <style>",
      "    * { box-sizing: border-box; margin: 0; padding: 0; }",
      "    body { font-family: var(--vscode-font-family); height: 100vh; display: flex; flex-direction: column; color: var(--vscode-foreground); background: var(--vscode-editor-background); }",
      "    #messages { flex: 1; overflow-y: auto; padding: 16px; }",
      "    .message { margin-bottom: 12px; padding: 8px 12px; border-radius: 8px; max-width: 85%; white-space: pre-wrap; }",
      "    .user { background: var(--vscode-button-background); color: var(--vscode-button-foreground); margin-left: auto; }",
      "    .assistant { background: var(--vscode-editor-inactiveSelectionBackground); }",
      "    .error { color: var(--vscode-errorForeground); font-style: italic; }",
      "    #input-area { display: flex; padding: 8px; border-top: 1px solid var(--vscode-panel-border); }",
      "    #input { flex: 1; padding: 8px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 4px; resize: none; }",
      "    #send { margin-left: 8px; padding: 8px 16px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer; }",
      "    #send:hover { background: var(--vscode-button-hoverBackground); }",
      "  </style>",
      "</head>",
      "<body>",
      '  <div id="messages"></div>',
      '  <div id="input-area">',
      '    <textarea id="input" rows="2" placeholder="Ask anything..."></textarea>',
      '    <button id="send">Send</button>',
      "  </div>",
      "  <script>",
      "    const vscode = acquireVsCodeApi();",
      '    const messagesEl = document.getElementById("messages");',
      '    const inputEl = document.getElementById("input");',
      '    const sendBtn = document.getElementById("send");',
      "    let currentAssistantEl = null;",
      "",
      "    function addMessage(role, content) {",
      '      const div = document.createElement("div");',
      '      div.className = "message " + role;',
      "      div.textContent = content;",
      "      messagesEl.appendChild(div);",
      "      messagesEl.scrollTop = messagesEl.scrollHeight;",
      "      return div;",
      "    }",
      "",
      '    sendBtn.addEventListener("click", () => send());',
      '    inputEl.addEventListener("keydown", (e) => {',
      '      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }',
      "    });",
      "",
      "    function send() {",
      "      const text = inputEl.value.trim();",
      "      if (!text) return;",
      '      inputEl.value = "";',
      '      vscode.postMessage({ type: "sendMessage", text });',
      "    }",
      "",
      '    window.addEventListener("message", (event) => {',
      "      const msg = event.data;",
      "      switch (msg.type) {",
      '        case "chat:userMessage": addMessage("user", msg.content); break;',
      '        case "chat:start": currentAssistantEl = addMessage("assistant", ""); break;',
      '        case "chat:chunk": if (currentAssistantEl) currentAssistantEl.textContent += msg.content; messagesEl.scrollTop = messagesEl.scrollHeight; break;',
      '        case "chat:end": currentAssistantEl = null; break;',
      '        case "error": addMessage("error", msg.message); break;',
      "      }",
      "    });",
      "  </script>",
      "</body>",
      "</html>"
    ].join("\n");
  }
  log(message) {
    this.outputChannel.appendLine("[ChatPanel] " + message);
  }
  dispose() {
    this.close();
  }
};

// src/services/WorkspaceSyncService.ts
var vscode12 = __toESM(require("vscode"));
var WorkspaceSyncService = class {
  client;
  outputChannel;
  watcher = null;
  syncDebounceTimer = null;
  constructor(client, outputChannel) {
    this.client = client;
    this.outputChannel = outputChannel;
  }
  /**
   * Full sync on connect — send complete workspace tree.
   */
  async syncOnConnect() {
    try {
      const tree = await this.scanWorkspace();
      await this.client.post("/api/workspace/sync", tree);
      this.log("Workspace synced: " + tree.files.length + " files");
      this.startWatching();
    } catch (error) {
      this.log("Sync failed: " + error.message);
    }
  }
  /**
   * Incremental sync — notify backend of file changes.
   */
  startWatching() {
    if (this.watcher) return;
    this.watcher = vscode12.workspace.createFileSystemWatcher("**/*");
    this.watcher.onDidCreate((uri) => {
      this.debouncedSync("created", uri);
    });
    this.watcher.onDidDelete((uri) => {
      this.debouncedSync("deleted", uri);
    });
    this.watcher.onDidChange((uri) => {
      this.debouncedSync("changed", uri);
    });
  }
  debouncedSync(event, uri) {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(async () => {
      try {
        const relativePath = vscode12.workspace.asRelativePath(uri);
        await this.client.post("/api/workspace/notify", {
          event,
          path: relativePath,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch {
      }
    }, 1e3);
  }
  async scanWorkspace() {
    const folders = vscode12.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return {
        workspace_name: "unknown",
        root_path: "",
        files: [],
        synced_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const rootFolder = folders[0];
    const excludePattern = await this.getExcludePattern();
    const fileUris = await vscode12.workspace.findFiles("**/*", excludePattern, 1e4);
    const files = [];
    for (const uri of fileUris) {
      try {
        const stat = await vscode12.workspace.fs.stat(uri);
        files.push({
          path: vscode12.workspace.asRelativePath(uri),
          type: stat.type === vscode12.FileType.Directory ? "directory" : "file",
          size: stat.size
        });
      } catch {
      }
    }
    return {
      workspace_name: rootFolder.name,
      root_path: rootFolder.uri.fsPath,
      files,
      synced_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async getExcludePattern() {
    return "{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.gradle/**,**/__pycache__/**}";
  }
  log(message) {
    this.outputChannel.appendLine("[WorkspaceSync] " + message);
  }
  dispose() {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = null;
    }
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
  }
};

// src/services/IndexingService.ts
var vscode13 = __toESM(require("vscode"));
var IndexingService = class {
  client;
  outputChannel;
  isIndexing = false;
  constructor(client, outputChannel) {
    this.client = client;
    this.outputChannel = outputChannel;
  }
  /**
   * Index all markdown documents in workspace.
   */
  async indexDocuments() {
    if (this.isIndexing) {
      vscode13.window.showWarningMessage("Indexing already in progress");
      return;
    }
    this.isIndexing = true;
    await vscode13.window.withProgress(
      {
        location: vscode13.ProgressLocation.Notification,
        title: "Indexing Documents",
        cancellable: true
      },
      async (progress, token) => {
        try {
          const mdFiles = await vscode13.workspace.findFiles("**/*.md", "{**/node_modules/**,**/.git/**}");
          const total = mdFiles.length;
          let processed = 0;
          for (const file of mdFiles) {
            if (token.isCancellationRequested) break;
            const content = await vscode13.workspace.fs.readFile(file);
            const relativePath = vscode13.workspace.asRelativePath(file);
            await this.client.post("/api/index/document", {
              path: relativePath,
              content: Buffer.from(content).toString("utf-8"),
              type: "markdown"
            });
            processed++;
            progress.report({
              increment: 1 / total * 100,
              message: processed + "/" + total + " \u2014 " + relativePath
            });
          }
          this.log("Indexed " + processed + "/" + total + " documents");
          vscode13.window.showInformationMessage("Indexed " + processed + " documents");
        } catch (error) {
          this.log("Indexing failed: " + error.message);
          vscode13.window.showErrorMessage("Document indexing failed: " + error.message);
        } finally {
          this.isIndexing = false;
        }
      }
    );
  }
  /**
   * Index source code files.
   */
  async indexSource() {
    if (this.isIndexing) {
      vscode13.window.showWarningMessage("Indexing already in progress");
      return;
    }
    this.isIndexing = true;
    await vscode13.window.withProgress(
      {
        location: vscode13.ProgressLocation.Notification,
        title: "Indexing Source Code",
        cancellable: true
      },
      async (progress, token) => {
        try {
          const sourceFiles = await vscode13.workspace.findFiles(
            "**/*.{ts,js,kt,java,py,go,rs}",
            "{**/node_modules/**,**/.git/**,**/dist/**,**/build/**}"
          );
          const total = sourceFiles.length;
          let processed = 0;
          const batchSize = 20;
          for (let i = 0; i < total; i += batchSize) {
            if (token.isCancellationRequested) break;
            const batch = sourceFiles.slice(i, i + batchSize);
            const entries = await Promise.all(
              batch.map(async (file) => {
                const content = await vscode13.workspace.fs.readFile(file);
                return {
                  path: vscode13.workspace.asRelativePath(file),
                  content: Buffer.from(content).toString("utf-8")
                };
              })
            );
            await this.client.post("/api/index/source", { files: entries });
            processed += batch.length;
            progress.report({
              increment: batch.length / total * 100,
              message: processed + "/" + total + " files"
            });
          }
          this.log("Indexed " + processed + "/" + total + " source files");
          vscode13.window.showInformationMessage("Indexed " + processed + " source files");
        } catch (error) {
          this.log("Source indexing failed: " + error.message);
          vscode13.window.showErrorMessage("Source indexing failed: " + error.message);
        } finally {
          this.isIndexing = false;
        }
      }
    );
  }
  log(message) {
    this.outputChannel.appendLine("[IndexingService] " + message);
  }
  dispose() {
  }
};

// src/extension.ts
var connectionManager;
var toolProxy;
var webviewManager;
var statusBarManager;
var authManager;
var tokenRefreshTimer;
var loginPanel;
var mcpConfigPanel;
var chatPanel;
var workspaceSyncService;
var indexingService;
async function activate(context) {
  const outputChannel = vscode14.window.createOutputChannel("Code Intelligence");
  const configManager = new ConfigurationManager();
  const notifications = new NotificationManager();
  await configManager.migrateIfNeeded();
  const config = configManager.getConfiguration();
  statusBarManager = new StatusBarManager();
  context.subscriptions.push(statusBarManager);
  authManager = new AuthManager(context.secrets);
  context.subscriptions.push(authManager);
  tokenRefreshTimer = new TokenRefreshTimer(authManager, config.url);
  context.subscriptions.push(tokenRefreshTimer);
  loginPanel = new LoginPanel(authManager, context.extensionUri, config.url);
  context.subscriptions.push(loginPanel);
  mcpConfigPanel = new McpConfigPanel(authManager, context.extensionUri, config.url);
  context.subscriptions.push(mcpConfigPanel);
  connectionManager = new ConnectionManager(config, authManager, outputChannel);
  context.subscriptions.push(connectionManager);
  toolProxy = new ToolProxy(connectionManager, outputChannel);
  context.subscriptions.push(toolProxy);
  webviewManager = new WebviewManager(connectionManager, context.extensionUri);
  context.subscriptions.push(webviewManager);
  const httpClient = connectionManager.getHttpClient();
  workspaceSyncService = new WorkspaceSyncService(httpClient, outputChannel);
  context.subscriptions.push(workspaceSyncService);
  indexingService = new IndexingService(httpClient, outputChannel);
  context.subscriptions.push(indexingService);
  chatPanel = new ChatPanel(httpClient, authManager, context.extensionUri, outputChannel);
  context.subscriptions.push(chatPanel);
  const stateDisposable = connectionManager.onStateChange((state) => {
    statusBarManager?.updateState(state);
  });
  context.subscriptions.push(stateDisposable);
  const authDisposable = authManager.onStateChange(async (state) => {
    if (state === "AUTHENTICATED") {
      loginPanel?.close();
      tokenRefreshTimer?.start();
      outputChannel.appendLine("[Auth] Authenticated as " + (authManager?.user?.username ?? "unknown"));
      await connectionManager?.connect();
      if (connectionManager?.isConnected()) {
        await toolProxy?.refreshTools();
        workspaceSyncService?.syncOnConnect().catch(() => {
        });
      }
    } else if (state === "UNAUTHENTICATED") {
      tokenRefreshTimer?.stop();
      loginPanel?.show();
      outputChannel.appendLine("[Auth] Unauthenticated - Login required");
    }
  });
  context.subscriptions.push(authDisposable);
  registerCommands(context, notifications, outputChannel);
  const configDisposable = configManager.onConfigurationChanged(() => {
    notifications.showInfo("Configuration changed. Reconnect to apply.");
  });
  context.subscriptions.push(configDisposable);
  initializeConnection(outputChannel);
}
function deactivate() {
  tokenRefreshTimer?.stop();
  connectionManager?.disconnect();
}
async function initializeConnection(outputChannel) {
  try {
    await authManager.initialize();
    if (authManager.isAuthenticated) {
      await tokenRefreshTimer.start();
      await connectionManager.connect();
      if (connectionManager.isConnected()) {
        await toolProxy.refreshTools();
        workspaceSyncService?.syncOnConnect().catch(() => {
        });
        outputChannel.appendLine("[Extension] Authenticated + Connected");
      }
    } else {
      loginPanel.show();
      outputChannel.appendLine("[Extension] No auth token - showing login");
    }
  } catch (error) {
    outputChannel.appendLine("[Extension] Init error: " + error.message);
    loginPanel.show();
  }
}
function registerCommands(context, notifications, _outputChannel) {
  context.subscriptions.push(
    vscode14.commands.registerCommand("codeIntel.reconnect", async () => {
      connectionManager?.disconnect();
      await connectionManager?.connect();
      if (connectionManager?.isConnected()) {
        await toolProxy?.refreshTools();
        notifications.showInfo("Reconnected to Backend");
      }
    }),
    vscode14.commands.registerCommand("codeIntel.disconnect", () => {
      connectionManager?.disconnect();
    }),
    vscode14.commands.registerCommand("codeIntel.showConnectionStatus", () => {
      const state = connectionManager?.state;
      if (state) {
        const version = state.backendVersion ?? "N/A";
        const authStatus = authManager?.isAuthenticated ? "Authenticated" : "Not authenticated";
        notifications.showInfo("State: " + state.state + " | Version: " + version + " | Auth: " + authStatus);
      }
    }),
    vscode14.commands.registerCommand("codeIntel.login", () => {
      loginPanel?.show();
    }),
    vscode14.commands.registerCommand("codeIntel.logout", async () => {
      if (!authManager?.isAuthenticated) {
        notifications.showInfo("Not currently authenticated.");
        return;
      }
      const refreshToken = await authManager.getRefreshToken();
      if (refreshToken) {
        const cfg = new ConfigurationManager().getConfiguration();
        try {
          await fetch(cfg.url + "/api/admin/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken }) });
        } catch {
        }
      }
      await authManager.clearTokens();
      tokenRefreshTimer?.stop();
    }),
    vscode14.commands.registerCommand("codeIntel.configureMcpServers", () => {
      if (!authManager?.isAuthenticated) {
        notifications.showWarning("Please login first.");
        loginPanel?.show();
        return;
      }
      mcpConfigPanel?.show();
    }),
    vscode14.commands.registerCommand("codeIntel.indexDocuments", async () => {
      if (!connectionManager?.isConnected()) {
        notifications.showWarning("Backend not connected.");
        return;
      }
      await indexingService?.indexDocuments();
    }),
    vscode14.commands.registerCommand("codeIntel.indexSource", async () => {
      if (!connectionManager?.isConnected()) {
        notifications.showWarning("Backend not connected.");
        return;
      }
      await indexingService?.indexSource();
    }),
    vscode14.commands.registerCommand("codeIntel.openChat", () => {
      if (!authManager?.isAuthenticated) {
        notifications.showWarning("Please login first.");
        loginPanel?.show();
        return;
      }
      chatPanel?.show();
    }),
    vscode14.commands.registerCommand("codeIntel.configureBackend", () => {
      vscode14.commands.executeCommand("workbench.action.openSettings", "codeIntel.backend");
    })
  );
  const panels = ["dashboard", "kbGraph", "analytics", "tags", "quality"];
  for (const panelId of panels) {
    context.subscriptions.push(
      vscode14.commands.registerCommand(
        "codeIntel.open" + panelId.charAt(0).toUpperCase() + panelId.slice(1),
        () => {
          webviewManager?.openPanel(panelId);
        }
      )
    );
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
