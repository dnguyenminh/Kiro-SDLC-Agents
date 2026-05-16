/**
 * Configuration loading — environment variables and config file.
 * Workspace resolution priority:
 * 1. --workspace CLI arg (highest — Kiro resolves ${workspaceFolder})
 * 2. CODE_INTEL_WORKSPACE env var
 * 3. initialize.roots[0].uri (MCP protocol)
 * 4. cwd() (lowest fallback)
 */

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

export interface AppConfig {
  workspace: string;
  dbPath: string;
  configPath: string;
  watchEnabled: boolean;
  watchDebounceMs: number;
  ollamaUrl: string | null;
  ollamaModel: string;
  excludePatterns: string[];
  includeExtensions: string[];
  maxFileSize: number;
}

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
export function loadConfig(): AppConfig {
  const workspace = resolveWorkspaceFromCli() ?? resolveWorkspaceFromEnv();
  return buildConfig(workspace);
}

/** Set workspace from MCP initialize roots (only if CLI/env not already set). */
export function setWorkspace(config: AppConfig, rootUri: string | null): AppConfig {
  // CLI arg and env var take priority over initialize roots
  if (resolveWorkspaceFromCli() || process.env['CODE_INTEL_WORKSPACE']) {
    return config;
  }
  const workspace = resolveWorkspaceFromRoots(rootUri);
  return buildConfig(workspace);
}

/** Convert a file:// URI to a local filesystem path. */
export function fileUriToPath(uri: string): string {
  try {
    return fileURLToPath(uri);
  } catch {
    // Fallback: manual strip for edge cases
    return uri.replace(/^file:\/\/\//, process.platform === 'win32' ? '' : '/');
  }
}

function resolveWorkspaceFromEnv(): string {
  const envWs = process.env['CODE_INTEL_WORKSPACE'];
  if (envWs) return path.resolve(envWs);
  return process.cwd();
}

function resolveWorkspaceFromCli(): string | null {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--workspace');
  if (idx >= 0 && args[idx + 1]) return path.resolve(args[idx + 1]);
  return null;
}

function resolveWorkspaceFromRoots(rootUri: string | null): string {
  // Env var always takes priority (backward compat)
  const envWs = process.env['CODE_INTEL_WORKSPACE'];
  if (envWs) return path.resolve(envWs);

  if (rootUri) return path.resolve(fileUriToPath(rootUri));
  return process.cwd();
}

function buildConfig(workspace: string): AppConfig {
  const codeIntelDir = path.join(workspace, '.code-intel');
  const configPath = path.join(codeIntelDir, 'config.json');
  const fileConfig = loadFileConfig(configPath);

  return {
    workspace,
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

function loadFileConfig(configPath: string): Record<string, any> {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (err) {
    console.error(`[config] Failed to read ${configPath}:`, err);
  }
  return {};
}

function envBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val === '1' || val.toLowerCase() === 'true';
}

function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}
