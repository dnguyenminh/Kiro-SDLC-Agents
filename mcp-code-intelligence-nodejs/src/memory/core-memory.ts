/**
 * CoreMemoryManager — manages pinned entries for auto-recall.
 * Pinned entries are injected into agent context on every search.
 * Enforces a 2000-token budget across all pinned entries.
 */

import Database from 'better-sqlite3';
import { KnowledgeEntry } from './models.js';
import { countTokens, truncateToFit } from './token-counter.js';

export interface CoreMemoryConfig {
  maxTokens: number;
  warningThreshold: number;
  maxPinnedEntries: number;
}

export interface PinnedEntrySummary {
  id: number;
  summary: string;
  tokens: number;
  pin_order: number;
}

const DEFAULT_CONFIG: CoreMemoryConfig = {
  maxTokens: 2000,
  warningThreshold: 1800,
  maxPinnedEntries: 10,
};

export class CoreMemoryManager {
  private readonly db: Database.Database;
  private readonly config: CoreMemoryConfig;

  constructor(db: Database.Database, config?: Partial<CoreMemoryConfig>) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Pin an entry. Returns success/failure message. */
  pin(entryId: number): string {
    const entry = this.getEntry(entryId);
    if (!entry) return `Error: entry ${entryId} not found`;
    if (entry.pinned) return `Entry ${entryId} is already pinned`;
    if (this.getPinnedCount() >= this.config.maxPinnedEntries) {
      return `Error: max pinned entries (${this.config.maxPinnedEntries}) reached`;
    }
    const budget = this.getRemainingBudget();
    const tokens = countTokens(entry.summary || entry.content);
    if (tokens > budget) {
      return `Error: entry needs ~${tokens} tokens but only ${budget} remaining in budget`;
    }
    const nextOrder = this.getNextPinOrder();
    this.db.prepare(
      "UPDATE knowledge_entries SET pinned = 1, pin_order = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(nextOrder, entryId);
    return `Pinned entry ${entryId} (order: ${nextOrder}, ~${tokens} tokens)`;
  }

  /** Unpin an entry. */
  unpin(entryId: number): string {
    const entry = this.getEntry(entryId);
    if (!entry) return `Error: entry ${entryId} not found`;
    if (!entry.pinned) return `Entry ${entryId} is not pinned`;
    this.db.prepare(
      "UPDATE knowledge_entries SET pinned = 0, pin_order = 0, updated_at = datetime('now') WHERE id = ?"
    ).run(entryId);
    return `Unpinned entry ${entryId}`;
  }

  /** List all pinned entries with token usage. */
  listPinned(): PinnedEntrySummary[] {
    const rows = this.db.prepare(
      'SELECT id, summary, content, pin_order FROM knowledge_entries WHERE pinned = 1 ORDER BY pin_order ASC'
    ).all() as Array<{ id: number; summary: string; content: string; pin_order: number }>;
    return rows.map(r => ({
      id: r.id,
      summary: r.summary || r.content.slice(0, 120),
      tokens: countTokens(r.summary || r.content),
      pin_order: r.pin_order,
    }));
  }

  /** Reorder a pinned entry to a new position. */
  reorder(entryId: number, newOrder: number): string {
    const entry = this.getEntry(entryId);
    if (!entry) return `Error: entry ${entryId} not found`;
    if (!entry.pinned) return `Error: entry ${entryId} is not pinned`;
    this.db.prepare(
      "UPDATE knowledge_entries SET pin_order = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newOrder, entryId);
    return `Reordered entry ${entryId} to position ${newOrder}`;
  }

  /** Get pinned context string for injection into search results. */
  getContext(): string {
    const pinned = this.listPinned();
    if (pinned.length === 0) return '';
    const parts: string[] = ['--- PINNED CONTEXT ---'];
    let usedTokens = countTokens(parts[0]);
    for (const p of pinned) {
      const line = `[#${p.id}] ${p.summary}`;
      const lineTokens = countTokens(line);
      if (usedTokens + lineTokens > this.config.maxTokens) {
        const remaining = this.config.maxTokens - usedTokens;
        parts.push(truncateToFit(line, remaining));
        break;
      }
      parts.push(line);
      usedTokens += lineTokens;
    }
    parts.push('--- END PINNED ---');
    return parts.join('\n');
  }

  /** Get token budget status. */
  getBudgetStatus(): { used: number; remaining: number; max: number; warning: boolean } {
    const used = this.getUsedTokens();
    const remaining = this.config.maxTokens - used;
    return {
      used,
      remaining,
      max: this.config.maxTokens,
      warning: used >= this.config.warningThreshold,
    };
  }

  private getEntry(id: number): (KnowledgeEntry & { pinned: number }) | undefined {
    return this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?')
      .get(id) as (KnowledgeEntry & { pinned: number }) | undefined;
  }

  private getPinnedCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge_entries WHERE pinned = 1').get() as { cnt: number };
    return row.cnt;
  }

  private getNextPinOrder(): number {
    const row = this.db.prepare('SELECT MAX(pin_order) as mx FROM knowledge_entries WHERE pinned = 1').get() as { mx: number | null };
    return (row.mx ?? 0) + 1;
  }

  private getUsedTokens(): number {
    const rows = this.db.prepare(
      'SELECT summary, content FROM knowledge_entries WHERE pinned = 1'
    ).all() as Array<{ summary: string; content: string }>;
    return rows.reduce((sum, r) => sum + countTokens(r.summary || r.content), 0);
  }

  private getRemainingBudget(): number {
    return this.config.maxTokens - this.getUsedTokens();
  }
}
