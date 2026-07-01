import * as os from 'os';
import * as fs from 'fs';
export class DashboardService {
    db;
    mcpOrchestrator;
    startTime = Date.now();
    constructor(db, mcpOrchestrator) {
        this.db = db;
        this.mcpOrchestrator = mcpOrchestrator;
    }
    getHealth() {
        const memUsage = process.memoryUsage();
        const cpus = os.cpus();
        const cpuPercent = cpus.reduce((acc, cpu) => { const total = Object.values(cpu.times).reduce((a, b) => a + b, 0); return acc + ((total - cpu.times.idle) / total) * 100; }, 0) / cpus.length;
        let sqliteSize = 0;
        try {
            const stat = fs.statSync(this.db.name);
            sqliteSize = stat.size / (1024 * 1024);
        }
        catch { }
        const activeSessions = this.db.prepare('SELECT COUNT(*) as cnt FROM sessions WHERE is_active = 1').get()?.cnt || 0;
        const alerts = [];
        if (memUsage.heapUsed / (1024 * 1024) > 80 * 0.01 * os.totalmem() / (1024 * 1024))
            alerts.push({ severity: 'warning', message: 'Memory usage > 80%', since: new Date().toISOString() });
        return {
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            memoryUsageMB: Math.round(memUsage.heapUsed / (1024 * 1024)),
            cpuPercent: Math.round(cpuPercent * 10) / 10,
            sqliteFileSizeMB: Math.round(sqliteSize * 10) / 10,
            mcpServers: { online: 0, total: 0 }, // TODO: get from orchestrator
            kbEntryCount: { user: 0, project: 0, shared: 0 }, // TODO: get from KB engine
            activeUsers: activeSessions,
            alerts,
        };
    }
    getActivity(limit = 20) {
        return this.db.prepare('SELECT audit_id, user_id, username, action, resource, timestamp FROM audit_entries ORDER BY timestamp DESC LIMIT ?').all(limit);
    }
}
//# sourceMappingURL=dashboard.service.js.map