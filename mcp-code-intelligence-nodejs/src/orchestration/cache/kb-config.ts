/**
 * KB Cache Config — reads tool_cache settings from orchestration.json.
 * KSA-139: Hot-reloadable config with sensible defaults.
 */

import * as fs from 'fs';

export interface KbCacheConfig {
  enabled: boolean;
  injectCount: number;
  lookupTimeoutMs: number;
  maxEntriesPerScope: number;
}

const DEFAULTS: KbCacheConfig = {
  enabled: true,
  injectCount: 5,
  lookupTimeoutMs: 100,
  maxEntriesPerScope: 100,
};

/** Read tool_cache config from orchestration.json settings. */
export function readKbCacheConfig(configPath: string): KbCacheConfig {
  try {
    if (!fs.existsSync(configPath)) return { ...DEFAULTS };
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const tc = raw?.settings?.tool_cache;
    if (!tc) return { ...DEFAULTS };
    return {
      enabled: tc.enabled ?? DEFAULTS.enabled,
      injectCount: clamp(tc.inject_count ?? DEFAULTS.injectCount, 0, 20),
      lookupTimeoutMs: clamp(tc.lookup_timeout_ms ?? DEFAULTS.lookupTimeoutMs, 50, 500),
      maxEntriesPerScope: clamp(tc.max_entries_per_scope ?? DEFAULTS.maxEntriesPerScope, 10, 500),
    };
  } catch (e: any) {
    console.error(`[kb-cache-config] Parse error, using defaults: ${e.message}`);
    return { ...DEFAULTS };
  }
}

/** Get default config (no file read). */
export function defaultKbCacheConfig(): KbCacheConfig {
  return { ...DEFAULTS };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
