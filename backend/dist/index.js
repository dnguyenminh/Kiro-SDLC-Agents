/**
 * Backend MCP Server entry point.
 * Initializes all modules, starts HTTP server on configured port.
 */
import pino from 'pino';
import { loadConfig } from './config/BackendConfig.js';
import { HttpServer } from './server/HttpServer.js';
import { ModuleRegistry } from './modules/ModuleRegistry.js';
import { MemoryModule } from './modules/memory/MemoryModule.js';
import { CodeIntelModule } from './modules/code-intel/CodeIntelModule.js';
import { OrchestrationModule } from './modules/orchestration/OrchestrationModule.js';
import { AnalyticsModule } from './modules/analytics/AnalyticsModule.js';
import { KBGraphModule } from './modules/kb-graph/KBGraphModule.js';
import { UtilityModule } from './modules/utility/UtilityModule.js';
const VERSION = '1.0.0';
async function main() {
    const config = loadConfig();
    const logger = pino({
        level: config.logLevel,
        transport: {
            target: 'pino/file',
            options: { destination: 1 }, // stdout
        },
    });
    logger.info({ version: VERSION, config: { port: config.port, host: config.host } }, 'Starting Backend MCP Server');
    // Initialize module registry
    const registry = new ModuleRegistry(logger);
    // Register all modules
    registry.register(new MemoryModule(logger));
    registry.register(new CodeIntelModule(logger));
    registry.register(new OrchestrationModule(logger));
    registry.register(new AnalyticsModule(logger));
    registry.register(new KBGraphModule(logger));
    registry.register(new UtilityModule(logger));
    // Initialize all modules in parallel
    await registry.initializeAll();
    logger.info({ readyModules: registry.getReadyCount(), totalModules: registry.getTotalCount() }, 'Modules initialized');
    // Start HTTP server
    const server = new HttpServer({
        port: config.port,
        host: config.host,
        logger,
        registry,
        version: VERSION,
    });
    await server.start();
    // Graceful shutdown
    const shutdown = async (signal) => {
        logger.info({ signal }, 'Shutdown signal received');
        await server.stop();
        await registry.shutdownAll();
        process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    logger.info({ pid: process.pid, port: config.port, version: VERSION }, 'Backend MCP Server ready');
}
main().catch((err) => {
    console.error('Fatal error starting Backend:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map