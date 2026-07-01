/**
 * HealthChecker — periodic GET /health poller with exponential backoff.
 * KSA-292: Updated to use ConnectionConfig with URL.
 * Implements TDD §5.5 State Machine and FSD BR-13, BR-17.
 */
export class HealthChecker {
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
//# sourceMappingURL=HealthChecker.js.map