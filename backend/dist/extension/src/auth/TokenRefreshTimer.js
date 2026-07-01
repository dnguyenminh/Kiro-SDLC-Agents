/**
 * TokenRefreshTimer — auto-refresh access token at (expiry - 5 min).
 * Implements TDD §5.2, FSD UC-3, BR-8.
 */
// BR-8: Refresh 5 minutes before expiry
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 30_000;
export class TokenRefreshTimer {
    authManager;
    timer = null;
    baseUrl;
    constructor(authManager, baseUrl) {
        this.authManager = authManager;
        this.baseUrl = baseUrl;
    }
    /**
     * Start the refresh timer based on current token expiry.
     */
    async start() {
        this.stop();
        const tokens = await this.authManager.getStoredTokens();
        if (!tokens)
            return;
        const now = Date.now();
        const refreshAt = tokens.expires_at - REFRESH_BUFFER_MS;
        const delay = Math.max(refreshAt - now, 1000); // At least 1s delay
        this.timer = setTimeout(() => this.doRefresh(), delay);
    }
    /**
     * Stop the refresh timer.
     */
    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    /**
     * Execute token refresh.
     */
    async doRefresh() {
        const refreshToken = await this.authManager.getRefreshToken();
        if (!refreshToken) {
            this.authManager.setUnauthenticated();
            return;
        }
        this.authManager.setRefreshing();
        try {
            const response = await fetch(`${this.baseUrl}/api/admin/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });
            if (!response.ok) {
                // Refresh failed — try once more after delay (EF-3)
                this.timer = setTimeout(async () => {
                    await this.retryRefresh(refreshToken);
                }, RETRY_DELAY_MS);
                return;
            }
            const data = (await response.json());
            await this.authManager.storeRefreshResult(data.access_token, data.refresh_token, data.expires_in);
            // Schedule next refresh
            await this.start();
        }
        catch {
            // Network error — retry once after 30s (EF-3)
            this.timer = setTimeout(async () => {
                await this.retryRefresh(refreshToken);
            }, RETRY_DELAY_MS);
        }
    }
    async retryRefresh(refreshToken) {
        try {
            const response = await fetch(`${this.baseUrl}/api/admin/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });
            if (!response.ok) {
                await this.authManager.clearTokens();
                return;
            }
            const data = (await response.json());
            await this.authManager.storeRefreshResult(data.access_token, data.refresh_token, data.expires_in);
            await this.start();
        }
        catch {
            await this.authManager.clearTokens();
        }
    }
    dispose() {
        this.stop();
    }
}
//# sourceMappingURL=TokenRefreshTimer.js.map