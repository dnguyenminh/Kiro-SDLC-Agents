/**
 * Orchestration configuration — interfaces and loader.
 * Reads orchestration.json from .code-intel/ directory.
 * Same format as Kotlin OrchestrationConfig.kt.
 */
export type TransportType = 'stdio' | 'httpStream';
export interface ServerEntry {
    command?: string;
    args: string[];
    env: Record<string, string>;
    url?: string;
    transportType?: TransportType;
    disabled: boolean;
    timeout: number;
    autoApprove: string[];
}
export interface AutoLogSettings {
    enabled: boolean;
    excludeTools: string[];
    maxArgLength: number;
}
export interface OrchestrationSettings {
    autoLog: AutoLogSettings;
    healthCheckIntervalMs: number;
    maxRestartRetries: number;
    similarityThreshold: number;
    maxRecursionDepth: number;
    discoveryTimeoutMs: number;
    kbSearchTimeoutMs: number;
}
export interface OrchestrationConfig {
    mcpServers: Record<string, ServerEntry>;
    settings: OrchestrationSettings;
}
/** Load orchestration.json from workspace .code-intel/ directory. */
export declare function loadOrchestrationConfig(workspace: string): OrchestrationConfig | null;
/** Load orchestration config from an explicit file path. */
export declare function loadOrchestrationConfigFromPath(configPath: string): OrchestrationConfig | null;
/** Get enabled (non-disabled) servers. */
export declare function enabledServers(config: OrchestrationConfig): Map<string, ServerEntry>;
//# sourceMappingURL=config.d.ts.map