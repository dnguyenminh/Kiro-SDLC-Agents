/**
 * ModuleRegistry — manages module lifecycle (initialize, shutdown).
 * Implements TDD §5.2 modules/ModuleRegistry.ts, §5.4 Registry pattern.
 */

import { IModule, ModuleStatus } from '../types/module';
import { ToolHandler, ToolDefinition } from '../types/tool';

export class ModuleRegistry {
  private readonly modules: Map<string, IModule> = new Map();

  register(module: IModule): void {
    this.modules.set(module.name, module);
  }

  async initializeAll(): Promise<void> {
    const initPromises = Array.from(this.modules.values()).map(async (module) => {
      try {
        await module.initialize();
      } catch (error) {
        console.error(`[ModuleRegistry] Failed to initialize module '${module.name}':`, error);
      }
    });

    await Promise.allSettled(initPromises);
  }

  async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this.modules.values()).map(async (module) => {
      try {
        await module.shutdown();
      } catch (error) {
        console.error(`[ModuleRegistry] Failed to shutdown module '${module.name}':`, error);
      }
    });

    await Promise.allSettled(shutdownPromises);
  }

  getModule(name: string): IModule | undefined {
    return this.modules.get(name);
  }

  getAllModules(): IModule[] {
    return Array.from(this.modules.values());
  }

  getModuleStatuses(): Record<string, ModuleStatus> {
    const statuses: Record<string, ModuleStatus> = {};
    for (const [name, module] of this.modules) {
      statuses[name] = module.status;
    }
    return statuses;
  }

  getAllToolHandlers(): Map<string, ToolHandler> {
    const handlers = new Map<string, ToolHandler>();
    for (const module of this.modules.values()) {
      if (module.status === 'ready') {
        for (const [name, handler] of module.getToolHandlers()) {
          handlers.set(name, handler);
        }
      }
    }
    return handlers;
  }

  getAllToolDefinitions(): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];
    for (const module of this.modules.values()) {
      if (module.status === 'ready') {
        definitions.push(...module.getToolDefinitions());
      }
    }
    return definitions;
  }

  isAllReady(): boolean {
    return Array.from(this.modules.values()).every((m) => m.status === 'ready');
  }

  get size(): number {
    return this.modules.size;
  }
}
