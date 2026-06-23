/**
 * SchedulerModule — background job scheduler for KB promotion and TTL cleanup.
 * Implements TDD §5.2 modules/scheduler, FSD BR-15 (30min), UC-7/UC-8.
 */
import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler } from '../../types/tool';
import { PromotionService } from '../memory/PromotionService';
import { KbRepository } from '../memory/KbRepository';
export declare class SchedulerModule implements IModule {
    private readonly promotionService;
    private readonly kbRepo;
    readonly name = "scheduler";
    private _status;
    private promotionTimer;
    private ttlCleanupTimer;
    get status(): ModuleStatus;
    constructor(promotionService: PromotionService, kbRepo: KbRepository);
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    private runPromotionJob;
    private runTtlCleanup;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
}
//# sourceMappingURL=SchedulerModule.d.ts.map