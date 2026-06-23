/**
 * KB Cache Config — reads tool_cache settings from orchestration.json.
 * KSA-139: Hot-reloadable config with sensible defaults.
 */
export interface KbCacheConfig {
    enabled: boolean;
    injectCount: number;
    lookupTimeoutMs: number;
    maxEntriesPerScope: number;
}
/** Read tool_cache config from orchestration.json settings. */
export declare function readKbCacheConfig(configPath: string): KbCacheConfig;
/** Get default config (no file read). */
export declare function defaultKbCacheConfig(): KbCacheConfig;
//# sourceMappingURL=kb-config.d.ts.map