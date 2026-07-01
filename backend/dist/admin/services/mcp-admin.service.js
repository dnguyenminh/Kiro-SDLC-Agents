// KSA-286: MCP Admin Service
import { AdminErrorCode } from '../types/admin.types.js';
export class MCPAdminService {
    mcpOrchestrator;
    constructor(mcpOrchestrator) {
        this.mcpOrchestrator = mcpOrchestrator;
    }
    listServers() {
        const servers = this.mcpOrchestrator?.getServers?.() || [];
        return servers.map((s) => ({
            serverId: s.id || s.serverId,
            serverName: s.name || s.serverName || s.id,
            status: s.status || 'STOPPED',
            tools: (s.tools || []).map((t) => ({ name: t.name, enabled: t.enabled !== false, lastCall: t.lastCall })),
            lastHeartbeat: s.lastHeartbeat,
            uptimeSeconds: s.uptimeSeconds || 0,
            restartCount: s.restartCount || 0,
        }));
    }
    getServer(serverId) {
        const servers = this.listServers();
        return servers.find(s => s.serverId === serverId) || null;
    }
    async restart(serverId) {
        try {
            await this.mcpOrchestrator?.restartServer?.(serverId);
            return { success: true, message: `Server ${serverId} restarted` };
        }
        catch (e) {
            throw { code: AdminErrorCode.RESTART_FAILED, message: e.message || 'Restart failed' };
        }
    }
    toggleTool(serverId, toolName, enabled) {
        this.mcpOrchestrator?.toggleTool?.(serverId, toolName, enabled);
    }
    getLogs(serverId, lines = 200) {
        return this.mcpOrchestrator?.getServerLogs?.(serverId, lines) || [];
    }
}
//# sourceMappingURL=mcp-admin.service.js.map