/**
 * NativeAddonResolver — Resolves better-sqlite3 native binding for standalone MCP server.
 *
 * Modes:
 * 1. Extension mode: BETTER_SQLITE3_BINDING env var set → use that path directly
 * 2. Standalone mode: auto-detect platform, check cache, download if needed
 * 3. Fallback: if download fails → try require("better-sqlite3") (npm-installed)
 *
 * Cache: ~/.code-intel/native-addons/better-sqlite3/v{version}/node-v{major}-{platform}-{arch}/better_sqlite3.node
 */
/**
 * Resolve the native binding path. Must be called (and awaited) before creating Database instances.
 * Returns the path to better_sqlite3.node, or undefined if fallback to npm-installed should be used.
 *
 * KSA-112: If cached binary has wrong NODE_MODULE_VERSION, auto-delete and re-download.
 */
export declare function resolveNativeBinding(): Promise<string | undefined>;
/**
 * Synchronous resolve — returns cached path or undefined.
 * Use after resolveNativeBinding() has been called at startup.
 */
export declare function resolveNativeBindingSync(): string | undefined;
