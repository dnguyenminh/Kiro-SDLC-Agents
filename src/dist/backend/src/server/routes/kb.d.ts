/**
 * KB routes — /api/kb/* endpoints.
 * Implements TDD §3.2.3 POST /api/kb/promote.
 */
import { Hono } from 'hono';
import { PromotionService } from '../../modules/memory/PromotionService';
import { TierAccessControl } from '../../modules/memory/TierAccessControl';
import { KbRepository } from '../../modules/memory/KbRepository';
export declare function createKbRoute(promotionService: PromotionService, kbRepo: KbRepository, tierAccess: TierAccessControl): Hono;
//# sourceMappingURL=kb.d.ts.map