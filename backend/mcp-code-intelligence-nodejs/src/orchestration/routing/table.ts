/**
 * Routing table — O(1) tool-to-server mapping.
 * Behavioral parity with Kotlin RoutingTable.kt.
 */

export interface RouteEntry {
  serverName: string;
  isNative: boolean;
}

export class RoutingTable {
  private routes = new Map<string, RouteEntry>();

  /** Rebuild routing table from native tools and child server tools. */
  rebuild(nativeNames: Set<string>, childByServer: Map<string, string[]>): void {
    this.routes.clear();
    for (const name of nativeNames) {
      this.routes.set(name, { serverName: 'native', isNative: true });
    }
    for (const [source, tools] of childByServer) {
      const serverName = source.replace(/^child:/, '');
      for (const toolName of tools) {
        if (!this.routes.has(toolName)) {
          this.routes.set(toolName, { serverName, isNative: false });
        }
      }
    }
  }

  /** Resolve tool name to route entry. Returns null if not found. */
  resolve(toolName: string): RouteEntry | null {
    return this.routes.get(toolName) ?? null;
  }

  /** Add a single route entry (for dynamically discovered nested tools). */
  addRoute(toolName: string, serverName: string): void {
    if (!this.routes.has(toolName)) {
      this.routes.set(toolName, { serverName, isNative: false });
    }
  }
}
