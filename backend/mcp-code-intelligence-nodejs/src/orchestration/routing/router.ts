/**
 * Smart router — routes tool calls to child servers with timeout propagation.
 * Behavioral parity with Kotlin SmartRouter.kt.
 */

import { LocalServerManager } from '../local/manager.js';
import { RoutingTable } from './table.js';

export interface ToolMetrics {
  callCount: number;
  errorCount: number;
  totalLatencyMs: number;
  lastCallAt: number | null;
}

export class SmartRouter {
  requestStartTime = 0;
  private metrics = new Map<string, ToolMetrics>();

  constructor(private serverManager: LocalServerManager, private routingTable: RoutingTable) {}

  /** Route a tool call with timeout propagation. */
  async route(toolName: string, args: Record<string, any>, timeoutMs = 30_000): Promise<string> {
    const route = this.routingTable.resolve(toolName);
    if (!route) throw new Error(`Tool '${toolName}' not found in any child server`);
    if (route.isNative) throw new Error(`Tool '${toolName}' is native — should not reach router`);
    const remaining = this.computeRemainingTimeout(timeoutMs, route.serverName);
    const start = Date.now();
    try {
      const result = await this.serverManager.callTool(route.serverName, toolName, args, remaining);
      this.recordMetric(toolName, Date.now() - start, false);
      return this.extractText(result);
    } catch (e: any) {
      this.recordMetric(toolName, Date.now() - start, true);
      throw new Error(`Tool '${toolName}' failed on server '${route.serverName}': ${e.message}`);
    }
  }

  getMetrics(): Map<string, ToolMetrics> { return new Map(this.metrics); }

  private computeRemainingTimeout(originalMs: number, serverName: string): number {
    if (this.requestStartTime <= 0) return originalMs;
    const elapsed = Date.now() - this.requestStartTime;
    const remaining = originalMs - elapsed;
    if (remaining <= 0) throw new Error(`Timeout exhausted before routing to server '${serverName}' (elapsed: ${elapsed}ms)`);
    return remaining;
  }

  private extractText(result: any): string {
    if (!result) return '{}';
    const content = result?.content;
    if (Array.isArray(content) && content.length > 0) {
      return content[0]?.text ?? '{}';
    }
    return JSON.stringify(result);
  }

  private recordMetric(tool: string, latencyMs: number, isError: boolean): void {
    let m = this.metrics.get(tool);
    if (!m) { m = { callCount: 0, errorCount: 0, totalLatencyMs: 0, lastCallAt: null }; this.metrics.set(tool, m); }
    m.callCount++;
    if (isError) m.errorCount++;
    m.totalLatencyMs += latencyMs;
    m.lastCallAt = Date.now();
  }
}
