/**
 * Module lifecycle registry.
 * Manages initialization, shutdown, and health status of all backend modules.
 */
export class ModuleRegistry {
    modules = new Map();
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    register(module) {
        this.modules.set(module.name, module);
        this.logger.info({ module: module.name }, 'Module registered');
    }
    async initializeAll() {
        const initPromises = Array.from(this.modules.entries()).map(async ([name, module]) => {
            try {
                this.logger.info({ module: name }, 'Initializing module');
                await module.initialize();
                this.logger.info({ module: name, status: module.status }, 'Module initialized');
            }
            catch (err) {
                this.logger.error({ module: name, err }, 'Module initialization failed');
            }
        });
        await Promise.allSettled(initPromises);
    }
    async shutdownAll() {
        const shutdownPromises = Array.from(this.modules.entries()).map(async ([name, module]) => {
            try {
                await module.shutdown();
                this.logger.info({ module: name }, 'Module shutdown complete');
            }
            catch (err) {
                this.logger.error({ module: name, err }, 'Module shutdown failed');
            }
        });
        await Promise.allSettled(shutdownPromises);
    }
    getToolHandlers() {
        const handlers = new Map();
        for (const module of this.modules.values()) {
            if (module.status === 'ready') {
                for (const [name, handler] of module.getToolHandlers()) {
                    handlers.set(name, handler);
                }
            }
        }
        return handlers;
    }
    getModule(name) {
        return this.modules.get(name);
    }
    getAllToolDefinitions() {
        const definitions = [];
        for (const module of this.modules.values()) {
            if (module.status === 'ready') {
                definitions.push(...module.getToolDefinitions());
            }
        }
        return definitions;
    }
    getHealth() {
        const health = {};
        for (const [name, module] of this.modules) {
            health[name] = module.status;
        }
        return health;
    }
    getModuleHealth() {
        return Array.from(this.modules.entries()).map(([name, module]) => ({
            name,
            status: module.status,
        }));
    }
    getReadyCount() {
        return Array.from(this.modules.values()).filter(m => m.status === 'ready').length;
    }
    getTotalCount() {
        return this.modules.size;
    }
    isAllReady() {
        return Array.from(this.modules.values()).every(m => m.status === 'ready');
    }
}
//# sourceMappingURL=ModuleRegistry.js.map