/**
 * Orchestration configuration — interfaces and loader.
 * Reads orchestration.json from .code-intel/ directory.
 * Same format as Kotlin OrchestrationConfig.kt.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ServerEntry {
  command: string;
  args: string[];
  env: Record<string, string>;
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

const DEFAULT_SETTINGS: OrchestrationSettings = {
  autoLog: { enabled: true, excludeTools: ['mem_audit'], maxArgLength: 200 },
  healthCheckIntervalMs: 30_000,
  maxRestartRetries: 3,
  similarityThreshold: 0.7,
  maxRecursionDepth: 3,
  discoveryTimeoutMs: 10_000,
  kbSearchTimeoutMs: 2_000,
};

/** Load orchestration.json from workspace .code-intel/ directory. */
export function loadOrchestrationConfig(workspace: string): OrchestrationConfig | null {
  const configPath = path.join(workspace, '.code-intel', 'orchestration.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return parseConfig(data);
  } catch (e: any) {
    console.error(`[orchestration] Config load failed: ${e.message}`);
    return null;
  }
}

/** Get enabled (non-disabled) servers. */
export function enabledServers(config: OrchestrationConfig): Map<string, ServerEntry> {
  const result = new Map<string, ServerEntry>();
  for (const [name, entry] of Object.entries(config.mcpServers)) {
    if (!entry.disabled) result.set(name, entry);
  }
  return result;
}

function parseConfig(data: any): OrchestrationConfig {
  const servers: Record<string, ServerEntry> = {};
  for (const [name, entry] of Object.entries(data.mcpServers ?? {})) {
    const e = entry as any;
    servers[name] = {
      command: e.command,
      args: e.args ?? [],
      env: e.env ?? {},
      disabled: e.disabled ?? false,
      timeout: e.timeout ?? 30_000,
      autoApprove: e.autoApprove ?? [],
    };
  }
  const s = data.settings ?? {};
  const al = s.autoLog ?? {};
  const settings: OrchestrationSettings = {
    autoLog: {
      enabled: al.enabled ?? DEFAULT_SETTINGS.autoLog.enabled,
      excludeTools: al.excludeTools ?? DEFAULT_SETTINGS.autoLog.excludeTools,
      maxArgLength: al.maxArgLength ?? DEFAULT_SETTINGS.autoLog.maxArgLength,
    },
    healthCheckIntervalMs: s.healthCheckIntervalMs ?? DEFAULT_SETTINGS.healthCheckIntervalMs,
    maxRestartRetries: s.maxRestartRetries ?? DEFAULT_SETTINGS.maxRestartRetries,
    similarityThreshold: s.similarityThreshold ?? DEFAULT_SETTINGS.similarityThreshold,
    maxRecursionDepth: s.maxRecursionDepth ?? DEFAULT_SETTINGS.maxRecursionDepth,
    discoveryTimeoutMs: s.discoveryTimeoutMs ?? DEFAULT_SETTINGS.discoveryTimeoutMs,
    kbSearchTimeoutMs: s.kbSearchTimeoutMs ?? DEFAULT_SETTINGS.kbSearchTimeoutMs,
  };
  return { mcpServers: servers, settings };
}
