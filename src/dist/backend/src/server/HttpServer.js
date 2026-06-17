/**
 * HttpServer — Hono app setup with middleware and routes.
 * Implements TDD §5.3 IHttpServer, §5.2 server/HttpServer.ts.
 * KSA-285: Added auth guard middleware, auth/config/kb routes.
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { localhostOnly } from './middleware/localhost-only';
import { requestLogger } from './middleware/request-logger';
import { createAuthGuard } from './middleware/auth-guard';
import { errorHandler } from './middleware/error-handler';
import { createHealthRoute } from './routes/health';
import { createToolsRoute } from './routes/tools';
import { createApiRoute } from './routes/api';
import { createAuthRoute } from './routes/auth';
import { createConfigRoute } from './routes/config';
import { createKbRoute } from './routes/kb';
export class HttpServer {
    app;
    server = null;
    _isRunning = false;
    get isRunning() {
        return this._isRunning;
    }
    constructor(deps) {
        this.app = new Hono();
        // Global middleware
        this.app.use('*', localhostOnly);
        this.app.use('*', requestLogger);
        // Auth guard (KSA-285)
        if (deps.authModule) {
            const authGuard = createAuthGuard(deps.authModule.tokenService);
            this.app.use('*', authGuard);
        }
        // Mount routes
        const healthRoute = createHealthRoute(deps.moduleRegistry, deps.version);
        const toolsRoute = createToolsRoute(deps.toolRouter, deps.moduleRegistry);
        const apiRoute = createApiRoute(deps.moduleRegistry);
        this.app.route('/', healthRoute);
        this.app.route('/', toolsRoute);
        this.app.route('/', apiRoute);
        // KSA-285: Auth routes
        if (deps.authModule) {
            const authRoute = createAuthRoute(deps.authModule);
            this.app.route('/', authRoute);
        }
        // KSA-285: Config routes
        if (deps.configModule) {
            const configRoute = createConfigRoute(deps.configModule);
            this.app.route('/', configRoute);
        }
        // KSA-285: KB routes
        if (deps.promotionService && deps.kbRepo && deps.tierAccess) {
            const kbRoute = createKbRoute(deps.promotionService, deps.kbRepo, deps.tierAccess);
            this.app.route('/', kbRoute);
        }
        // Error handler
        this.app.onError(errorHandler);
    }
    async start(port, host) {
        return new Promise((resolve) => {
            this.server = serve({
                fetch: this.app.fetch,
                port,
                hostname: host,
            }, () => {
                this._isRunning = true;
                console.log('[HttpServer] Listening on http://' + host + ':' + port);
                resolve();
            });
        });
    }
    async stop() {
        if (this.server) {
            this.server.close();
            this._isRunning = false;
            console.log('[HttpServer] Stopped');
        }
    }
}
//# sourceMappingURL=HttpServer.js.map