/**
 * SchedulerModule — background job scheduler for KB promotion and TTL cleanup.
 * Implements TDD §5.2 modules/scheduler, FSD BR-15 (30min), UC-7/UC-8.
 */

import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler } from '../../types/tool';
import { PromotionService } from '../memory/PromotionService';
import { KbRepository } from '../memory/KbRepository';

const PROMOTION_INTERVAL_MS = 30 * 60 * 1000; // BR-15: 30 min
const TTL_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export class SchedulerModule implements IModule {
  readonly name = 'scheduler';
  private _status: ModuleStatus = 'initializing';
  private promotionTimer: ReturnType<typeof setInterval> | null = null;
  private ttlCleanupTimer: ReturnType<typeof setInterval> | null = null;

  get status(): ModuleStatus {
    return this._status;
  }

  constructor(
    private readonly promotionService: PromotionService,
    private readonly kbRepo: KbRepository,
  ) {}

  async initialize(): Promise<void> {
    console.log('[SchedulerModule] Initializing...');

    this.promotionTimer = setInterval(() => this.runPromotionJob(), PROMOTION_INTERVAL_MS);
    this.ttlCleanupTimer = setInterval(() => this.runTtlCleanup(), TTL_CLEANUP_INTERVAL_MS);

    this._status = 'ready';
    console.log('[SchedulerModule] Ready — promotion: 30min, TTL cleanup: 1h');
  }

  async shutdown(): Promise<void> {
    if (this.promotionTimer) clearInterval(this.promotionTimer);
    if (this.ttlCleanupTimer) clearInterval(this.ttlCleanupTimer);
    this.promotionTimer = null;
    this.ttlCleanupTimer = null;
    this._status = 'initializing';
    console.log('[SchedulerModule] Shut down');
  }

  private runPromotionJob(): void {
    try {
      const userToProject = this.promotionService.promoteUserToProject();
      const projectToShared = this.promotionService.promoteProjectToShared();
      if (userToProject.length > 0 || projectToShared.length > 0) {
        console.log(`[SchedulerModule] Promoted: ${userToProject.length} U→P, ${projectToShared.length} P→S`);
      }
    } catch (error) {
      console.error('[SchedulerModule] Promotion job failed:', error);
    }
  }

  private runTtlCleanup(): void {
    try {
      const deleted = this.kbRepo.deleteExpiredEntries();
      if (deleted > 0) {
        console.log(`[SchedulerModule] TTL cleanup: deleted ${deleted} expired entries`);
      }
    } catch (error) {
      console.error('[SchedulerModule] TTL cleanup failed:', error);
    }
  }

  getToolHandlers(): Map<string, ToolHandler> {
    return new Map();
  }

  getToolDefinitions(): ToolDefinition[] {
    return [];
  }
}
