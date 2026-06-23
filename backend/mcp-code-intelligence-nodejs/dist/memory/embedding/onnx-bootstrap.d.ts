/**
 * OnnxBootstrap — Self-downloads prebuilt onnxruntime-node binaries when running standalone.
 *
 * When the MCP server is spawned by the Kiro extension, ONNX_RUNTIME_PATH is injected via env.
 * When running standalone (e.g. via `npx mcp-code-intelligence`), this module handles:
 *   1. Check if ONNX_RUNTIME_PATH is already set → use it
 *   2. Check local cache (~/.code-intel/native-addons/onnxruntime-node/...) → use if exists
 *   3. Download from GitHub Release → extract → cache → set path
 *
 * Uses the same release manifest format as the extension's OnnxAddonManager.
 */
/**
 * Ensure onnxruntime-node is available. Returns the path to the onnxruntime-node directory.
 * Sets process.env.ONNX_RUNTIME_PATH as side effect.
 *
 * Priority:
 * 1. ONNX_RUNTIME_PATH env var (set by extension)
 * 2. Local cache
 * 3. Auto-download from GitHub Release
 *
 * @returns Path to onnxruntime-node directory, or null if unavailable.
 */
export declare function ensureOnnxRuntime(): Promise<string | null>;
/**
 * Get the cached ONNX Runtime path without downloading.
 */
export declare function getCachedOnnxPath(): string | null;
//# sourceMappingURL=onnx-bootstrap.d.ts.map