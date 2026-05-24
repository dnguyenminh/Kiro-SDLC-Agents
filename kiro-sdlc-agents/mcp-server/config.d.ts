/**
 * Configuration loading — environment variables and config file.
 * Workspace resolution priority:
 * 1. --workspace CLI arg (highest — Kiro resolves ${workspaceFolder})
 * 2. CODE_INTEL_WORKSPACE env var
 * 3. initialize.roots[0].uri (MCP protocol)
 * 4. cwd() (lowest fallback)
 */
export interface AppConfig {
    workspace: string;
    viewerPort: number;
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
/** Create initial config — checks CLI args, env, then cwd. */
export declare function loadConfig(): AppConfig;
/** Set workspace from MCP initialize roots (only if CLI/env not already set). */
export declare function setWorkspace(config: AppConfig, rootUri: string | null): AppConfig;
/** Convert a file:// URI to a local filesystem path. */
export declare function fileUriToPath(uri: string): string;
/** Resolve orchestration config path from --config CLI arg. Null = use default workspace path. */
export declare function resolveOrchestrationConfigPath(): string | null;
//# sourceMappingURL=config.d.ts.map