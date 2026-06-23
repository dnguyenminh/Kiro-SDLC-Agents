"use strict";
/**
 * HealthChecker — Periodic /health endpoint polling.
 * Fires onHealthFail event when backend becomes unreachable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthChecker = void 0;
class HealthChecker {
    httpClient;
    interval;
    timer = null;
    failListeners = [];
    constructor(httpClient, interval = 30000) {
        this.httpClient = httpClient;
        this.interval = interval;
    }
    onHealthFail(listener) {
        this.failListeners.push(listener);
    }
    start() {
        this.stop();
        this.timer = setInterval(() => this.check(), this.interval);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    async checkOnce() {
        return this.httpClient.healthCheck();
    }
    async check() {
        const healthy = await this.httpClient.healthCheck();
        if (!healthy) {
            for (const listener of this.failListeners) {
                listener();
            }
        }
    }
}
exports.HealthChecker = HealthChecker;
//# sourceMappingURL=HealthChecker.js.map