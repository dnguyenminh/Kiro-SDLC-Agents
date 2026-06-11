/**
 * Backend MCP Server — entry point.
 * Implements TDD §5.2 index.ts.
 * KSA-285: Added AuthModule, ConfigModule, SchedulerModule, KbRepository.
 */

import { loadConfig } from './config/BackendConfig';
import { HttpServer } from './server/HttpServer';
import { ModuleRegistry } from './modules/ModuleRegistry';
import { ToolRouter } from './tools/ToolRouter';
import { MemoryModule } from './modules/memory/MemoryModule';
import { CodeIntelModule } from './modules/code-intel/CodeIntelModule';
import { OrchestrationModule } from './modules/orchestration/OrchestrationModule';
import { AnalyticsModule } from './modules/analytics/AnalyticsModule';
import { KBGraphModule } from './modules/kb-graph/KBGraphModule';
import { UtilityModule } from './modules/utility/UtilityModule';
import { AuthModule } from './modules/auth/AuthModule';
import { ConfigModule } from './modules/config/ConfigModule';
import { SchedulerModule } from './modules/scheduler/SchedulerModule';
import { KbRepository } from './modules/memory/KbRepository';
import { PromotionService } from './modules/memory/PromotionService';
import { TierAccessControl } from './modules/memory/TierAccessControl';
import { IDatabase } from './modules/auth/UserRepository';

const VERSION = '1.1.0';

function createDatabaseShim(_dbPath: string): IDatabase {
  return {
    prepare(_sql: string) {
      return {
        get(..._params: unknown[]) { return undefined; },
        all(..._params: unknown[]) { return []; },
        run(..._params: unknown[]) { return { changes: 0, lastInsertRowid: 0 }; },
      };
    },
    exec(_sql: string) { /* placeholder */ },
  };
}

async function main(): Promise<void> {
  console.log('[Backend] Code Intelligence MCP Server v' + VERSION);
  console.log('[Backend] Starting...');

  const config = loadConfig();
  const db = createDatabaseShim(config.dbPath);

  // Module registry
  const moduleRegistry = new ModuleRegistry();
  moduleRegistry.register(new MemoryModule());
  moduleRegistry.register(new CodeIntelModule());
  moduleRegistry.register(new OrchestrationModule());
  moduleRegistry.register(new AnalyticsModule());
  moduleRegistry.register(new KBGraphModule());
  moduleRegistry.register(new UtilityModule());

  // KSA-285: Auth & Config modules
  const authModule = new AuthModule(db, config.jwtSecret);
  moduleRegistry.register(authModule);

  const configModule = new ConfigModule(db, config.encryptionKey);
  moduleRegistry.register(configModule);

  // KSA-285: KB multi-tier support
  const kbRepo = new KbRepository(db);
  const promotionService = new PromotionService(kbRepo);
  const tierAccess = new TierAccessControl();

  // KSA-285: Scheduler module
  const schedulerModule = new SchedulerModule(promotionService, kbRepo);
  moduleRegistry.register(schedulerModule);

  // Tool router
  const toolRouter = new ToolRouter(moduleRegistry);

  // HTTP server
  const httpServer = new HttpServer({
    moduleRegistry,
    toolRouter,
    config,
    version: VERSION,
    authModule,
    configModule,
    promotionService,
    kbRepo,
    tierAccess,
  });

  await httpServer.start(config.port, config.host);

  console.log('[Backend] Initializing modules...');
  await moduleRegistry.initializeAll();

  const toolCount = moduleRegistry.getAllToolDefinitions().length;
  console.log('[Backend] All modules ready. ' + toolCount + ' tools available.');

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log('[Backend] Received ' + signal + ', shutting down...');
    await httpServer.stop();
    await moduleRegistry.shutdownAll();
    console.log('[Backend] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('[Backend] Fatal error:', error);
  process.exit(1);
});
