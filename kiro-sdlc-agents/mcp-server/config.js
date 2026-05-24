"use strict";
/**
 * Configuration loading — environment variables and config file.
 * Workspace resolution priority:
 * 1. --workspace CLI arg (highest — Kiro resolves ${workspaceFolder})
 * 2. CODE_INTEL_WORKSPACE env var
 * 3. initialize.roots[0].uri (MCP protocol)
 * 4. cwd() (lowest fallback)
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
exports.loadConfig = loadConfig;
exports.setWorkspace = setWorkspace;
exports.fileUriToPath = fileUriToPath;
exports.resolveOrchestrationConfigPath = resolveOrchestrationConfigPath;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const url_1 = require("url");
const DEFAULT_EXCLUDE = [
    'node_modules', '.git', 'dist', 'build', '.gradle',
    '.idea', '.vscode', '__pycache__', '.venv', 'target',
    '.code-intel', 'coverage', '.next', '.nuxt',
];
const DEFAULT_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx', '.kt', '.java', '.py',
    '.go', '.rs', '.c', '.cpp', '.h', '.hpp', '.cs',
    '.rb', '.php', '.swift', '.scala', '.sql', '.sh',
    '.yaml', '.yml', '.json', '.toml', '.gradle.kts',
];
/** Create initial config — checks CLI args, env, then cwd. */
function loadConfig() {
    const workspace = resolveWorkspaceFromCli() ?? resolveWorkspaceFromEnv();
    return buildConfig(workspace);
}
/** Set workspace from MCP initialize roots (only if CLI/env not already set). */
function setWorkspace(config, rootUri) {
    // CLI arg and env var take priority over initialize roots
    if (resolveWorkspaceFromCli() || process.env['CODE_INTEL_WORKSPACE']) {
        return config;
    }
    const workspace = resolveWorkspaceFromRoots(rootUri);
    return buildConfig(workspace);
}
/** Convert a file:// URI to a local filesystem path. */
function fileUriToPath(uri) {
    try {
        return (0, url_1.fileURLToPath)(uri);
    }
    catch {
        // Fallback: manual strip for edge cases
        return uri.replace(/^file:\/\/\//, process.platform === 'win32' ? '' : '/');
    }
}
function resolveWorkspaceFromEnv() {
    const envWs = process.env['CODE_INTEL_WORKSPACE'];
    if (envWs)
        return path.resolve(envWs);
    return process.cwd();
}
function resolveWorkspaceFromCli() {
    const args = process.argv.slice(2);
    const idx = args.indexOf('--workspace');
    if (idx >= 0 && args[idx + 1])
        return path.resolve(args[idx + 1]);
    return null;
}
function resolveViewerPort() {
    const args = process.argv.slice(2);
    const idx = args.indexOf('--viewer-port');
    if (idx >= 0 && args[idx + 1])
        return parseInt(args[idx + 1], 10);
    const envPort = process.env['CODE_INTEL_VIEWER_PORT'];
    if (envPort)
        return parseInt(envPort, 10);
    return 3202;
}
/** Resolve orchestration config path from --config CLI arg. Null = use default workspace path. */
function resolveOrchestrationConfigPath() {
    const args = process.argv.slice(2);
    const idx = args.indexOf('--config');
    if (idx >= 0 && args[idx + 1])
        return path.resolve(args[idx + 1]);
    return null;
}
function resolveWorkspaceFromRoots(rootUri) {
    // Env var always takes priority (backward compat)
    const envWs = process.env['CODE_INTEL_WORKSPACE'];
    if (envWs)
        return path.resolve(envWs);
    if (rootUri)
        return path.resolve(fileUriToPath(rootUri));
    return process.cwd();
}
function buildConfig(workspace) {
    const codeIntelDir = path.join(workspace, '.code-intel');
    const configPath = path.join(codeIntelDir, 'config.json');
    const fileConfig = loadFileConfig(configPath);
    return {
        workspace,
        viewerPort: resolveViewerPort(),
        dbPath: path.join(codeIntelDir, 'index.db'),
        configPath,
        watchEnabled: envBool('CODE_INTEL_WATCH', fileConfig.watchEnabled ?? true),
        watchDebounceMs: envInt('CODE_INTEL_DEBOUNCE', fileConfig.watchDebounceMs ?? 500),
        ollamaUrl: process.env['OLLAMA_URL'] ?? fileConfig.ollamaUrl ?? null,
        ollamaModel: process.env['OLLAMA_MODEL'] ?? fileConfig.ollamaModel ?? 'nomic-embed-text',
        excludePatterns: fileConfig.excludePatterns ?? DEFAULT_EXCLUDE,
        includeExtensions: fileConfig.includeExtensions ?? DEFAULT_EXTENSIONS,
        maxFileSize: fileConfig.maxFileSize ?? 512_000,
    };
}
function loadFileConfig(configPath) {
    try {
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
    }
    catch (err) {
        console.error(`[config] Failed to read ${configPath}:`, err);
    }
    return {};
}
function envBool(key, fallback) {
    const val = process.env[key];
    if (val === undefined)
        return fallback;
    return val === '1' || val.toLowerCase() === 'true';
}
function envInt(key, fallback) {
    const val = process.env[key];
    if (val === undefined)
        return fallback;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? fallback : parsed;
}
//# sourceMappingURL=config.js.map