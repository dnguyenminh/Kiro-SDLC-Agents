/**
 * TierAccessControl — enforces visibility rules for multi-tier KB.
 * Implements TDD §5.4 Strategy pattern, FSD BR-9 through BR-11, BR-22.
 */
import { KbEntry, TierAccessContext } from './types';
export declare class TierAccessControl {
    canRead(entry: KbEntry, context: TierAccessContext): boolean;
    canWrite(tier: 1 | 2 | 3, context: TierAccessContext, projectId?: string): boolean;
    canPromote(entry: KbEntry, targetTier: 2 | 3, context: TierAccessContext): boolean;
    filterAccessible(entries: KbEntry[], context: TierAccessContext): KbEntry[];
}
//# sourceMappingURL=TierAccessControl.d.ts.map