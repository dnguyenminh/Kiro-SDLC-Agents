"use strict";
/**
 * HealthChecker — periodic GET /health poller with exponential backoff.
 * Implements TDD §5.5 State Machine and FSD BR-13, BR-17.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthChecker = void 0;
class HealthChecker {
    intervalId = null;
    client;
    config;
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }
    async checkOnce() {
        try {
            const response = await this.client.health();
            return { success: true, response };
        }
        catch (error) {
            return { success: false, error: error };
        }
    }
    startPolling(onResult) {
        this.stopPolling();
        this.intervalId = setInterval(async () => {
            const result = await this.checkOnce();
            onResult(result);
        }, this.config.healthCheckInterval);
    }
    stopPolling() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    dispose() {
        this.stopPolling();
    }
}
exports.HealthChecker = HealthChecker;
//# sourceMappingURL=HealthChecker.js.map