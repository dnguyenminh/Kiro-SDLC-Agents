"use strict";
/**
 * TokenRefreshTimer — Periodically checks token expiry and refreshes.
 * Runs every 5 minutes when authenticated.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenRefreshTimer = void 0;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
class TokenRefreshTimer {
    authManager;
    timer = null;
    constructor(authManager) {
        this.authManager = authManager;
    }
    start() {
        this.stop();
        this.timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    async check() {
        if (!this.authManager.isAuthenticated) {
            this.stop();
            return;
        }
        try {
            await this.authManager.refreshToken();
        }
        catch {
            // Refresh failed — AuthManager handles state transition
        }
    }
}
exports.TokenRefreshTimer = TokenRefreshTimer;
//# sourceMappingURL=TokenRefreshTimer.js.map