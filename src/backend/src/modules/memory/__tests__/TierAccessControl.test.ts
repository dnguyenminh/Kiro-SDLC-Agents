/**
 * TierAccessControl Unit Tests
 * UT-08: User Cannot Read Other's Tier 1
 * UT-09: Project Member Reads Tier 2
 * UT-10: Admin Writes Tier 3
 * UT-11: Promotion User to Project Criteria
 * UT-12: Promotion Project to Shared (OR logic)
 */

import { describe, it, expect } from 'vitest';
import { TierAccessControl } from '../TierAccessControl';
import { KbEntry, TierAccessContext } from '../types';

function createEntry(overrides: Partial<KbEntry> = {}): KbEntry {
  return {
    id: 'entry-001',
    tier: 1,
    owner_id: 'user-A',
    project_id: null,
    title: 'Test Entry',
    content: 'test content',
    content_hash: 'abc123',
    embedding: null,
    tags: '[]',
    quality_score: 0.5,
    ttl_days: null,
    promoted: 0,
    promoted_from: null,
    promoted_by: null,
    referenced_by_projects: '[]',
    admin_promoted: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('TierAccessControl — Unit Tests', () => {
  const accessControl = new TierAccessControl();

  // UT-08: User Cannot Read Other's Tier 1
  describe('UT-08: canRead Tier 1 isolation', () => {
    it('owner can read their own Tier 1 entry', () => {
      const entry = createEntry({ tier: 1, owner_id: 'user-A' });
      const context: TierAccessContext = { userId: 'user-A', projects: [], role: 'user' };
      expect(accessControl.canRead(entry, context)).toBe(true);
    });

    it('other user cannot read someone else Tier 1 entry', () => {
      const entry = createEntry({ tier: 1, owner_id: 'user-A' });
      const context: TierAccessContext = { userId: 'user-B', projects: [], role: 'user' };
      expect(accessControl.canRead(entry, context)).toBe(false);
    });

    it('even admin cannot read other user Tier 1 entry', () => {
      const entry = createEntry({ tier: 1, owner_id: 'user-A' });
      const context: TierAccessContext = { userId: 'admin-1', projects: [], role: 'admin' };
      expect(accessControl.canRead(entry, context)).toBe(false);
    });
  });

  // UT-09: Project Member Reads Tier 2
  describe('UT-09: canRead Tier 2 project visibility', () => {
    it('project member can read Tier 2 project entry', () => {
      const entry = createEntry({ tier: 2, project_id: 'proj-A' });
      const context: TierAccessContext = { userId: 'user-X', projects: ['proj-A'], role: 'user' };
      expect(accessControl.canRead(entry, context)).toBe(true);
    });

    it('non-member cannot read Tier 2 project entry', () => {
      const entry = createEntry({ tier: 2, project_id: 'proj-A' });
      const context: TierAccessContext = { userId: 'user-X', projects: ['proj-B'], role: 'user' };
      expect(accessControl.canRead(entry, context)).toBe(false);
    });

    it('entry with null project_id is not readable', () => {
      const entry = createEntry({ tier: 2, project_id: null });
      const context: TierAccessContext = { userId: 'user-X', projects: ['proj-A'], role: 'user' };
      expect(accessControl.canRead(entry, context)).toBe(false);
    });
  });

  // Tier 3 — everyone can read
  describe('canRead Tier 3 — universally accessible', () => {
    it('anyone can read Tier 3 entries', () => {
      const entry = createEntry({ tier: 3 });
      const userCtx: TierAccessContext = { userId: 'anyone', projects: [], role: 'user' };
      expect(accessControl.canRead(entry, userCtx)).toBe(true);
    });
  });

  // UT-10: Admin Writes Tier 3
  describe('UT-10: canWrite Tier 3 admin only', () => {
    it('admin can write to Tier 3', () => {
      const context: TierAccessContext = { userId: 'admin-1', projects: [], role: 'admin' };
      expect(accessControl.canWrite(3, context)).toBe(true);
    });

    it('regular user cannot write to Tier 3', () => {
      const context: TierAccessContext = { userId: 'user-1', projects: [], role: 'user' };
      expect(accessControl.canWrite(3, context)).toBe(false);
    });

    it('anyone can write to Tier 1', () => {
      const context: TierAccessContext = { userId: 'user-1', projects: [], role: 'user' };
      expect(accessControl.canWrite(1, context)).toBe(true);
    });

    it('project member can write to Tier 2', () => {
      const context: TierAccessContext = { userId: 'user-1', projects: ['proj-A'], role: 'user' };
      expect(accessControl.canWrite(2, context, 'proj-A')).toBe(true);
    });

    it('non-member cannot write to Tier 2', () => {
      const context: TierAccessContext = { userId: 'user-1', projects: ['proj-B'], role: 'user' };
      expect(accessControl.canWrite(2, context, 'proj-A')).toBe(false);
    });
  });

  // UT-11: Promotion criteria (canPromote)
  describe('UT-11: canPromote from Tier 1 to Tier 2', () => {
    it('owner can promote their own Tier 1 entry to Tier 2', () => {
      const entry = createEntry({ tier: 1, owner_id: 'user-A' });
      const context: TierAccessContext = { userId: 'user-A', projects: ['proj-A'], role: 'user' };
      expect(accessControl.canPromote(entry, 2, context)).toBe(true);
    });

    it('non-owner cannot promote another user Tier 1 entry', () => {
      const entry = createEntry({ tier: 1, owner_id: 'user-A' });
      const context: TierAccessContext = { userId: 'user-B', projects: ['proj-A'], role: 'user' };
      expect(accessControl.canPromote(entry, 2, context)).toBe(false);
    });

    it('admin can promote any entry', () => {
      const entry = createEntry({ tier: 1, owner_id: 'user-A' });
      const context: TierAccessContext = { userId: 'admin-1', projects: [], role: 'admin' };
      expect(accessControl.canPromote(entry, 2, context)).toBe(true);
      expect(accessControl.canPromote(entry, 3, context)).toBe(true);
    });
  });

  // UT-12: filterAccessible
  describe('UT-12: filterAccessible filters by tier rules', () => {
    it('filters entries based on access rules', () => {
      const entries: KbEntry[] = [
        createEntry({ id: '1', tier: 1, owner_id: 'user-A' }),
        createEntry({ id: '2', tier: 1, owner_id: 'user-B' }),
        createEntry({ id: '3', tier: 2, project_id: 'proj-A' }),
        createEntry({ id: '4', tier: 2, project_id: 'proj-B' }),
        createEntry({ id: '5', tier: 3 }),
      ];

      const context: TierAccessContext = { userId: 'user-A', projects: ['proj-A'], role: 'user' };
      const accessible = accessControl.filterAccessible(entries, context);

      expect(accessible.map(e => e.id)).toEqual(['1', '3', '5']);
    });
  });
});
