/**
 * ModuleRegistry — manages module lifecycle (initialize, shutdown).
 * Implements TDD §5.2 modules/ModuleRegistry.ts, §5.4 Registry pattern.
 */
export class ModuleRegistry {
    modules = new Map();
    register(module) {
        this.modules.set(module.name, module);
    }
    async initializeAll() {
        const initPromises = Array.from(this.modules.values()).map(async (module) => {
            try {
                await module.initialize();
            }
            catch (error) {
                console.error(`[ModuleRegistry] Failed to initialize module '${module.name}':`, error);
            }
        });
        await Promise.allSettled(initPromises);
    }
    async shutdownAll() {
        const shutdownPromises = Array.from(this.modules.values()).map(async (module) => {
            try {
                await module.shutdown();
            }
            catch (error) {
                console.error(`[ModuleRegistry] Failed to shutdown module '${module.name}':`, error);
            }
        });
        await Promise.allSettled(shutdownPromises);
    }
    getModule(name) {
        return this.modules.get(name);
    }
    getAllModules() {
        return Array.from(this.modules.values());
    }
    getModuleStatuses() {
        const statuses = {};
        for (const [name, module] of this.modules) {
            statuses[name] = module.status;
        }
        return statuses;
    }
    getAllToolHandlers() {
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
    getAllToolDefinitions() {
        const definitions = [];
        for (const module of this.modules.values()) {
            if (module.status === 'ready') {
                definitions.push(...module.getToolDefinitions());
            }
        }
        return definitions;
    }
    isAllReady() {
        return Array.from(this.modules.values()).every((m) => m.status === 'ready');
    }
    get size() {
        return this.modules.size;
    }
}
//# sourceMappingURL=ModuleRegistry.js.map