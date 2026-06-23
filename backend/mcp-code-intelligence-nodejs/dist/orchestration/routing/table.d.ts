/**
 * Routing table — O(1) tool-to-server mapping.
 * Behavioral parity with Kotlin RoutingTable.kt.
 */
export interface RouteEntry {
    serverName: string;
    isNative: boolean;
}
export declare class RoutingTable {
    private routes;
    /** Rebuild routing table from native tools and child server tools. */
    rebuild(nativeNames: Set<string>, childByServer: Map<string, string[]>): void;
    /** Resolve tool name to route entry. Returns null if not found. */
    resolve(toolName: string): RouteEntry | null;
    /** Add a single route entry (for dynamically discovered nested tools). */
    addRoute(toolName: string, serverName: string): void;
}
//# sourceMappingURL=table.d.ts.map