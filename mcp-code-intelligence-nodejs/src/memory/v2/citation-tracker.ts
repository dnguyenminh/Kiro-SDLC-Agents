/**
 * KSA-79: Citation Tracking & Source Attribution.
 */

import type Database from 'better-sqlite3';

export class CitationTracker {
  constructor(private readonly db: Database.Database) {}

  executeCite(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    const citedBy = args.cited_by as string ?? '';
    if (!entryId || !citedBy) return 'Error: entry_id and cited_by required';
    const context = args.context as string ?? null;
    this.db.prepare('INSERT INTO citations (entry_id, cited_by, context) VALUES (?, ?, ?)').run(entryId, citedBy, context);
    return JSON.stringify({ entry_id: entryId, cited_by: citedBy, status: 'recorded' });
  }

  execute(args: Record<string, unknown>): string {
    const action = (args.action as string) ?? 'most_cited';
    const limit = (args.limit as number) ?? 10;

    switch (action) {
      case 'entry': return this.getCitationsForEntry(args, limit);
      case 'uncited': return JSON.stringify(this.getUncited(limit), null, 2);
      case 'by_agent': return this.getCitationsByAgent(args, limit);
      default: return JSON.stringify(this.getMostCited(limit), null, 2);
    }
  }

  private getCitationsForEntry(args: Record<string, unknown>, limit: number): string {
    const entryId = args.entry_id as number;
    if (!entryId) return 'Error: entry_id required';
    const rows = this.db.prepare(
      'SELECT cited_by, context, cited_at FROM citations WHERE entry_id = ? ORDER BY cited_at DESC LIMIT ?'
    ).all(entryId, limit);
    return JSON.stringify(rows, null, 2);
  }

  private getMostCited(limit: number): object[] {
    return this.db.prepare(
      'SELECT c.entry_id, ke.summary, ke.type, COUNT(*) as citation_count FROM citations c JOIN knowledge_entries ke ON c.entry_id = ke.id GROUP BY c.entry_id ORDER BY citation_count DESC LIMIT ?'
    ).all(limit) as object[];
  }

  private getUncited(limit: number): object[] {
    return this.db.prepare(
      'SELECT ke.id, ke.summary, ke.type, ke.tier FROM knowledge_entries ke LEFT JOIN citations c ON ke.id = c.entry_id WHERE c.id IS NULL AND ke.archived_at IS NULL ORDER BY ke.access_count DESC LIMIT ?'
    ).all(limit) as object[];
  }

  private getCitationsByAgent(args: Record<string, unknown>, limit: number): string {
    const agent = args.agent as string ?? '';
    if (!agent) return 'Error: agent required';
    const rows = this.db.prepare(
      'SELECT c.entry_id, ke.summary, c.context, c.cited_at FROM citations c JOIN knowledge_entries ke ON c.entry_id = ke.id WHERE c.cited_by = ? ORDER BY c.cited_at DESC LIMIT ?'
    ).all(agent, limit);
    return JSON.stringify(rows, null, 2);
  }
}
