/**
 * TierAccessControl — enforces visibility rules for multi-tier KB.
 * Implements TDD §5.4 Strategy pattern, FSD BR-9 through BR-11, BR-22.
 */

import { KbEntry, TierAccessContext } from './types';

export class TierAccessControl {
  canRead(entry: KbEntry, context: TierAccessContext): boolean {
    switch (entry.tier) {
      case 1:
        return entry.owner_id === context.userId;
      case 2:
        return entry.project_id !== null && context.projects.includes(entry.project_id);
      case 3:
        return true;
      default:
        return false;
    }
  }

  canWrite(tier: 1 | 2 | 3, context: TierAccessContext, projectId?: string): boolean {
    switch (tier) {
      case 1:
        return true;
      case 2:
        return projectId !== undefined && context.projects.includes(projectId);
      case 3:
        return context.role === 'admin';
      default:
        return false;
    }
  }

  canPromote(entry: KbEntry, targetTier: 2 | 3, context: TierAccessContext): boolean {
    if (context.role === 'admin') return true;
    if (targetTier === 2 && entry.tier === 1) {
      return entry.owner_id === context.userId;
    }
    return false;
  }

  filterAccessible(entries: KbEntry[], context: TierAccessContext): KbEntry[] {
    return entries.filter((entry) => this.canRead(entry, context));
  }
}
