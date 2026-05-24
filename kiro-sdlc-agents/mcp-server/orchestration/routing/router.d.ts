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
export declare class SmartRouter {
    private serverManager;
    private routingTable;
    requestStartTime: number;
    private metrics;
    constructor(serverManager: LocalServerManager, routingTable: RoutingTable);
    /** Route a tool call with timeout propagation. */
    route(toolName: string, args: Record<string, any>, timeoutMs?: number): Promise<string>;
    getMetrics(): Map<string, ToolMetrics>;
    private computeRemainingTimeout;
    private extractText;
    private recordMetric;
}
//# sourceMappingURL=router.d.ts.map