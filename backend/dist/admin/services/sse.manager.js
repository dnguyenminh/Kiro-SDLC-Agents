export class SSEManager {
    clients = new Map();
    heartbeatInterval;
    constructor() { this.heartbeatInterval = setInterval(() => this.heartbeat(), 15000); }
    addClient(userId, res) {
        // Close existing connection for this user (1 per user limit)
        const existing = this.clients.get(userId);
        if (existing) {
            try {
                existing.res.end();
            }
            catch { }
        }
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write('retry: 30000\n\n');
        this.clients.set(userId, { userId, res, connectedAt: Date.now() });
        res.on('close', () => { this.clients.delete(userId); });
    }
    broadcast(event, data) {
        const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const client of this.clients.values()) {
            try {
                client.res.write(msg);
            }
            catch { }
        }
    }
    sendToUser(userId, event, data) {
        const client = this.clients.get(userId);
        if (client) {
            try {
                client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            }
            catch { }
        }
    }
    heartbeat() {
        for (const client of this.clients.values()) {
            try {
                client.res.write(': keepalive\n\n');
            }
            catch {
                this.clients.delete(client.userId);
            }
        }
    }
    getClientCount() { return this.clients.size; }
    destroy() { clearInterval(this.heartbeatInterval); for (const c of this.clients.values()) {
        try {
            c.res.end();
        }
        catch { }
    } this.clients.clear(); }
}
//# sourceMappingURL=sse.manager.js.map