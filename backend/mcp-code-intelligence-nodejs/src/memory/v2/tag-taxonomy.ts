/**
 * KSA-77: Faceted Search with Tag Taxonomy.
 */

import type Database from 'better-sqlite3';

export class TagTaxonomy {
  constructor(private readonly db: Database.Database) {}

  execute(args: Record<string, unknown>): string {
    const action = (args.action as string) ?? 'taxonomy';

    switch (action) {
      case 'create': return this.createTag(args);
      case 'tag': return this.tagEntry(args);
      case 'untag': return this.untagEntry(args);
      case 'search': return this.searchByTags(args);
      case 'popular': return this.getPopular(args);
      case 'entry_tags': return this.getEntryTags(args);
      default: return this.getTaxonomy(args);
    }
  }

  private createTag(args: Record<string, unknown>): string {
    const tag = args.tag as string ?? '';
    if (!tag) return 'Error: tag required';
    const category = args.category as string ?? 'general';
    const parent = args.parent_tag as string ?? null;
    this.db.prepare('INSERT OR IGNORE INTO tag_taxonomy (tag, category, parent_tag) VALUES (?, ?, ?)').run(tag, category, parent);
    return JSON.stringify({ created: tag, category, parent_tag: parent });
  }

  private tagEntry(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    const tagsStr = args.tags as string ?? '';
    if (!entryId || !tagsStr) return 'Error: entry_id and tags required';
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
    let added = 0;
    for (const tag of tags) {
      this.db.prepare('INSERT OR IGNORE INTO tag_taxonomy (tag) VALUES (?)').run(tag);
      const tagRow = this.db.prepare('SELECT id FROM tag_taxonomy WHERE tag = ?').get(tag) as any;
      if (tagRow) {
        this.db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)').run(entryId, tagRow.id);
        this.db.prepare('UPDATE tag_taxonomy SET usage_count = usage_count + 1 WHERE id = ?').run(tagRow.id);
        added++;
      }
    }
    return JSON.stringify({ entry_id: entryId, tags_added: added });
  }

  private untagEntry(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    const tagsStr = args.tags as string ?? '';
    if (!entryId || !tagsStr) return 'Error: entry_id and tags required';
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
    let removed = 0;
    for (const tag of tags) {
      const tagRow = this.db.prepare('SELECT id FROM tag_taxonomy WHERE tag = ?').get(tag) as any;
      if (tagRow) {
        this.db.prepare('DELETE FROM entry_tags WHERE entry_id = ? AND tag_id = ?').run(entryId, tagRow.id);
        this.db.prepare('UPDATE tag_taxonomy SET usage_count = MAX(0, usage_count - 1) WHERE id = ?').run(tagRow.id);
        removed++;
      }
    }
    return JSON.stringify({ entry_id: entryId, tags_removed: removed });
  }

  private searchByTags(args: Record<string, unknown>): string {
    const tagsStr = args.tags as string ?? '';
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
    if (!tags.length) return 'Error: tags required for search';
    const operator = (args.operator as string) ?? 'AND';
    const limit = (args.limit as number) ?? 20;
    const placeholders = tags.map(() => '?').join(',');
    const minCount = operator === 'AND' ? tags.length : 1;
    const rows = this.db.prepare(
      `SELECT ke.id, ke.summary, ke.type, ke.tier, COUNT(*) as match_count FROM entry_tags et JOIN tag_taxonomy tt ON et.tag_id = tt.id JOIN knowledge_entries ke ON et.entry_id = ke.id WHERE tt.tag IN (${placeholders}) AND ke.archived_at IS NULL GROUP BY ke.id HAVING match_count >= ? ORDER BY match_count DESC LIMIT ?`
    ).all(...tags, minCount, limit);
    return JSON.stringify(rows, null, 2);
  }

  private getPopular(args: Record<string, unknown>): string {
    const limit = (args.limit as number) ?? 20;
    const rows = this.db.prepare('SELECT tag, category, usage_count, parent_tag FROM tag_taxonomy ORDER BY usage_count DESC LIMIT ?').all(limit);
    return JSON.stringify(rows, null, 2);
  }

  private getEntryTags(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    if (!entryId) return 'Error: entry_id required';
    const rows = this.db.prepare(
      'SELECT tt.tag, tt.category FROM entry_tags et JOIN tag_taxonomy tt ON et.tag_id = tt.id WHERE et.entry_id = ?'
    ).all(entryId);
    return JSON.stringify(rows, null, 2);
  }

  private getTaxonomy(args: Record<string, unknown>): string {
    const category = args.category as string;
    const rows = category
      ? this.db.prepare('SELECT tag, category, parent_tag, usage_count FROM tag_taxonomy WHERE category = ? ORDER BY tag').all(category)
      : this.db.prepare('SELECT tag, category, parent_tag, usage_count FROM tag_taxonomy ORDER BY category, tag').all();
    return JSON.stringify(rows, null, 2);
  }
}
