import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
const connectedTransports = new Set();
export function getMcpServer(registry, logger) {
    const server = new Server({
        name: 'kiro-backend-mcp',
        version: '1.0.0',
    }, {
        capabilities: {
            tools: {}
        }
    });
    // Register tools from the registry
    const tools = registry.getAllToolDefinitions();
    const handlers = registry.getToolHandlers();
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: tools.map(tool => ({
                name: tool.name,
                description: tool.description || '',
                inputSchema: tool.inputSchema || { type: 'object', properties: {} }
            }))
        };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const handler = handlers.get(name);
        if (!handler) {
            return {
                content: [{ type: 'text', text: `Error: Unknown tool ${name}` }],
                isError: true,
            };
        }
        try {
            const result = await handler(args || {});
            // Auto-emit notifications for KB changes
            if (!result.isError) {
                if (name.includes('ingest') || name.includes('create')) {
                    broadcastNotification('kb_entry_added', { tool: name });
                }
                else if (name.includes('update') || name.includes('modify')) {
                    broadcastNotification('kb_entry_updated', { tool: name });
                }
                else if (name.includes('delete') || name.includes('remove')) {
                    broadcastNotification('kb_entry_deleted', { tool: name });
                }
                else if (name.includes('tag')) {
                    broadcastNotification('tag_created', { tool: name });
                }
            }
            return result;
        }
        catch (err) {
            logger.error({ err, tool: name }, 'Error executing MCP tool');
            return {
                content: [{ type: 'text', text: `Error: ${err.message}` }],
                isError: true,
            };
        }
    });
    return server;
}
export function broadcastNotification(method, params) {
    for (const transport of connectedTransports) {
        try {
            transport.send({
                jsonrpc: '2.0',
                method: `notifications/${method}`,
                params,
            });
        }
        catch (err) {
            // ignore
        }
    }
}
export function registerTransport(transport) {
    connectedTransports.add(transport);
    transport.onclose = () => {
        connectedTransports.delete(transport);
    };
}
//# sourceMappingURL=mcpServer.js.map