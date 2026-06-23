/**
 * Transport detection and server process interface.
 * Determines whether a server entry should use stdio or httpStream transport.
 */

import { ServerEntry, TransportType } from '../config.js';
import { ServerState } from './process.js';

/** Common interface for both stdio and httpStream server processes. */
export interface IServerProcess {
  readonly name: string;
  state: ServerState;
  tools: Record<string, any>[];
  retryCount: number;
  start(): Promise<boolean>;
  stop(): void;
  restart(maxRetries: number): Promise<boolean>;
  callTool(toolName: string, args: Record<string, any>, timeoutMs: number): Promise<any>;
  healthCheck(): Promise<boolean>;
  isAlive(): boolean;
}

/**
 * Detect transport type from server entry config.
 * - url present, no command → httpStream
 * - command present, no url → stdio
 * - both present → use transportType field (default httpStream)
 * - neither → stdio (will fail at spawn, preserves existing error behavior)
 */
export function detectTransport(entry: ServerEntry): TransportType {
  if (entry.url && !entry.command) return 'httpStream';
  if (entry.command && !entry.url) return 'stdio';
  if (entry.url && entry.command) return entry.transportType === 'stdio' ? 'stdio' : 'httpStream';
  return 'stdio';
}
