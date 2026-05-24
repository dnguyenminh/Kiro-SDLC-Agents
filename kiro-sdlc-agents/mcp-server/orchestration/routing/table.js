"use strict";
/**
 * Routing table — O(1) tool-to-server mapping.
 * Behavioral parity with Kotlin RoutingTable.kt.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutingTable = void 0;
class RoutingTable {
    routes = new Map();
    /** Rebuild routing table from native tools and child server tools. */
    rebuild(nativeNames, childByServer) {
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
    resolve(toolName) {
        return this.routes.get(toolName) ?? null;
    }
    /** Add a single route entry (for dynamically discovered nested tools). */
    addRoute(toolName, serverName) {
        if (!this.routes.has(toolName)) {
            this.routes.set(toolName, { serverName, isNative: false });
        }
    }
}
exports.RoutingTable = RoutingTable;
//# sourceMappingURL=table.js.map