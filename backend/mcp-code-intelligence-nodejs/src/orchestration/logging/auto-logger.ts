/**
 * Auto-logger — logs tool calls to memory audit trail.
 * Behavioral parity with Kotlin AutoLogger.kt.
 */

import { AutoLogSettings } from '../config.js';

export class AutoLogger {
  constructor(private memoryEngine: any, private settings: AutoLogSettings) {}

  logCall(tool: string, args: string, result: string, latencyMs: number, source: string, isError = false): void {
    if (!this.settings.enabled) return;
    if (this.settings.excludeTools.includes(tool)) return;
    if (!this.memoryEngine) return;
    const truncatedArgs = args.substring(0, this.settings.maxArgLength);
    let details = `${tool}(${truncatedArgs}) → ${latencyMs}ms [${source}]`;
    if (isError) details += ' [ERROR]';
    try {
      this.memoryEngine.audit.log('TOOL_CALL', undefined, this.memoryEngine.getSessionId?.(), details);
    } catch { /* graceful degradation */ }
  }
}
