/**
 * Unit tests for ModuleRegistry.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ModuleRegistry } from '../src/modules/ModuleRegistry';
import { IModule, ModuleStatus } from '../src/types/module';
import { ToolDefinition, ToolHandler } from '../src/types/tool';

class TestModule implements IModule {
  readonly name: string;
  private _status: ModuleStatus = 'initializing';
  public initCalled = false;
  public shutdownCalled = false;

  get status(): ModuleStatus {
    return this._status;
  }

  constructor(name: string) {
    this.name = name;
  }

  async initialize(): Promise<void> {
    this.initCalled = true;
    this._status = 'ready';
  }

  async shutdown(): Promise<void> {
    this.shutdownCalled = true;
    this._status = 'initializing';
  }

  getToolHandlers(): Map<string, ToolHandler> {
    const handlers = new Map<string, ToolHandler>();
    handlers.set(this.name + '_tool', async () => ({
      content: [{ type: 'text', text: 'result' }],
      isError: false,
    }));
    return handlers;
  }

  getToolDefinitions(): ToolDefinition[] {
    return [{
      name: this.name + '_tool',
      description: 'Tool for ' + this.name,
      inputSchema: { type: 'object', properties: {} },
      category: 'utility',
    }];
  }
}

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  it('registers modules', () => {
    registry.register(new TestModule('mod1'));
    registry.register(new TestModule('mod2'));
    expect(registry.size).toBe(2);
  });

  it('initializes all modules in parallel', async () => {
    const mod1 = new TestModule('mod1');
    const mod2 = new TestModule('mod2');
    registry.register(mod1);
    registry.register(mod2);

    await registry.initializeAll();
    expect(mod1.initCalled).toBe(true);
    expect(mod2.initCalled).toBe(true);
    expect(mod1.status).toBe('ready');
    expect(mod2.status).toBe('ready');
  });

  it('shuts down all modules', async () => {
    const mod1 = new TestModule('mod1');
    registry.register(mod1);
    await registry.initializeAll();
    await registry.shutdownAll();
    expect(mod1.shutdownCalled).toBe(true);
  });

  it('returns module statuses', async () => {
    const mod1 = new TestModule('mod1');
    registry.register(mod1);
    await registry.initializeAll();

    const statuses = registry.getModuleStatuses();
    expect(statuses['mod1']).toBe('ready');
  });

  it('collects all tool handlers from ready modules', async () => {
    registry.register(new TestModule('mod1'));
    registry.register(new TestModule('mod2'));
    await registry.initializeAll();

    const handlers = registry.getAllToolHandlers();
    expect(handlers.size).toBe(2);
    expect(handlers.has('mod1_tool')).toBe(true);
    expect(handlers.has('mod2_tool')).toBe(true);
  });

  it('isAllReady returns true when all modules ready', async () => {
    registry.register(new TestModule('mod1'));
    expect(registry.isAllReady()).toBe(false);
    await registry.initializeAll();
    expect(registry.isAllReady()).toBe(true);
  });
});
