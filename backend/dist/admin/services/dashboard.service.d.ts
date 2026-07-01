import { DashboardHealth } from '../types/admin.types.js';
export declare class DashboardService {
    private db;
    private mcpOrchestrator;
    private startTime;
    constructor(db: any, mcpOrchestrator: any);
    getHealth(): DashboardHealth;
    getActivity(limit?: number): any[];
}
