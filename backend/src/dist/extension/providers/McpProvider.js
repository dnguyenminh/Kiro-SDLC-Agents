"use strict";
/**
 * McpProvider — MCP resource discovery
 * KSA-252
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpProvider = void 0;
class McpProvider {
    context;
    constructor(context) {
        this.context = context;
    }
    async getResources() {
        try {
            const raw = this.context.getMcpResources();
            return raw.map(r => ({
                server: r.server,
                name: r.name,
                type: r.type,
                description: r.description,
            }));
        }
        catch {
            return [];
        }
    }
    async getResourceContent(server, resource) {
        // In real implementation, this would call the MCP server
        return `[MCP Resource: ${server}/${resource}]`;
    }
}
exports.McpProvider = McpProvider;
//# sourceMappingURL=McpProvider.js.map