/**
 * SchedulerModule — background job scheduler for KB promotion and TTL cleanup.
 * Implements TDD §5.2 modules/scheduler, FSD BR-15 (30min), UC-7/UC-8.
 */
const PROMOTION_INTERVAL_MS = 30 * 60 * 1000; // BR-15: 30 min
const TTL_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
export class SchedulerModule {
    promotionService;
    kbRepo;
    name = 'scheduler';
    _status = 'initializing';
    promotionTimer = null;
    ttlCleanupTimer = null;
    get status() {
        return this._status;
    }
    constructor(promotionService, kbRepo) {
        this.promotionService = promotionService;
        this.kbRepo = kbRepo;
    }
    async initialize() {
        console.log('[SchedulerModule] Initializing...');
        this.promotionTimer = setInterval(() => this.runPromotionJob(), PROMOTION_INTERVAL_MS);
        this.ttlCleanupTimer = setInterval(() => this.runTtlCleanup(), TTL_CLEANUP_INTERVAL_MS);
        this._status = 'ready';
        console.log('[SchedulerModule] Ready — promotion: 30min, TTL cleanup: 1h');
    }
    async shutdown() {
        if (this.promotionTimer)
            clearInterval(this.promotionTimer);
        if (this.ttlCleanupTimer)
            clearInterval(this.ttlCleanupTimer);
        this.promotionTimer = null;
        this.ttlCleanupTimer = null;
        this._status = 'initializing';
        console.log('[SchedulerModule] Shut down');
    }
    runPromotionJob() {
        try {
            const userToProject = this.promotionService.promoteUserToProject();
            const projectToShared = this.promotionService.promoteProjectToShared();
            if (userToProject.length > 0 || projectToShared.length > 0) {
                console.log(`[SchedulerModule] Promoted: ${userToProject.length} U→P, ${projectToShared.length} P→S`);
            }
        }
        catch (error) {
            console.error('[SchedulerModule] Promotion job failed:', error);
        }
    }
    runTtlCleanup() {
        try {
            const deleted = this.kbRepo.deleteExpiredEntries();
            if (deleted > 0) {
                console.log(`[SchedulerModule] TTL cleanup: deleted ${deleted} expired entries`);
            }
        }
        catch (error) {
            console.error('[SchedulerModule] TTL cleanup failed:', error);
        }
    }
    getToolHandlers() {
        return new Map();
    }
    getToolDefinitions() {
        return [];
    }
}
//# sourceMappingURL=SchedulerModule.js.map