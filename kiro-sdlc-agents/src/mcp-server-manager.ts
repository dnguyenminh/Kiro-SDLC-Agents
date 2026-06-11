/**
 * McpServerManager — Re-exports the in-process implementation (KSA-260).
 *
 * Previously this file contained the child-process spawn-based server manager.
 * Now it re-exports from mcp-server-inprocess.ts which runs the MCP server
 * directly in the extension host process.
 *
 * Legacy implementation preserved in mcp-server-manager-legacy.ts for reference.
 */

export { McpServerManager } from "./mcp-server-inprocess";

// Re-export getNonce utility that some panels import from this module
import * as crypto from "crypto";

/**
 * Generate a cryptographic nonce for CSP script authorization.
 */
export function getNonce(): string {
  const array = crypto.randomBytes(16);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
