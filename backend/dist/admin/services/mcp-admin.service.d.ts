import { MCPServerInfo } from '../types/admin.types.js';
export declare class MCPAdminService {
    private mcpOrchestrator;
    constructor(mcpOrchestrator: any);
    listServers(): MCPServerInfo[];
    getServer(serverId: string): MCPServerInfo | null;
    restart(serverId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    toggleTool(serverId: string, toolName: string, enabled: boolean): void;
    getLogs(serverId: string, lines?: number): string[];
}
