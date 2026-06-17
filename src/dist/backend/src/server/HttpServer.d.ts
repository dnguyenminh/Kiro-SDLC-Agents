/**
 * HttpServer — Hono app setup with middleware and routes.
 * Implements TDD §5.3 IHttpServer, §5.2 server/HttpServer.ts.
 * KSA-285: Added auth guard middleware, auth/config/kb routes.
 */
import { ModuleRegistry } from '../modules/ModuleRegistry';
import { ToolRouter } from '../tools/ToolRouter';
import { BackendConfig } from '../config/BackendConfig';
import { AuthModule } from '../modules/auth/AuthModule';
import { ConfigModule } from '../modules/config/ConfigModule';
import { PromotionService } from '../modules/memory/PromotionService';
import { KbRepository } from '../modules/memory/KbRepository';
import { TierAccessControl } from '../modules/memory/TierAccessControl';
export interface IHttpServer {
    start(port: number, host: string): Promise<void>;
    stop(): Promise<void>;
    readonly isRunning: boolean;
}
export interface HttpServerDeps {
    moduleRegistry: ModuleRegistry;
    toolRouter: ToolRouter;
    config: BackendConfig;
    version: string;
    authModule?: AuthModule;
    configModule?: ConfigModule;
    promotionService?: PromotionService;
    kbRepo?: KbRepository;
    tierAccess?: TierAccessControl;
}
export declare class HttpServer implements IHttpServer {
    private readonly app;
    private server;
    private _isRunning;
    get isRunning(): boolean;
    constructor(deps: HttpServerDeps);
    start(port: number, host: string): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=HttpServer.d.ts.map