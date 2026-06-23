"use strict";
/**
 * KSA-77: Faceted Search with Tag Taxonomy.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TagTaxonomy = void 0;
class TagTaxonomy {
    db;
    constructor(db) {
        this.db = db;
    }
    execute(args) {
        const action = args.action ?? 'taxonomy';
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
    createTag(args) {
        const tag = args.tag ?? '';
        if (!tag)
            return 'Error: tag required';
        const category = args.category ?? 'general';
        const parent = args.parent_tag ?? null;
        this.db.prepare('INSERT OR IGNORE INTO tag_taxonomy (tag, category, parent_tag) VALUES (?, ?, ?)').run(tag, category, parent);
        return JSON.stringify({ created: tag, category, parent_tag: parent });
    }
    tagEntry(args) {
        const entryId = args.entry_id;
        const tagsStr = args.tags ?? '';
        if (!entryId || !tagsStr)
            return 'Error: entry_id and tags required';
        const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
        let added = 0;
        for (const tag of tags) {
            this.db.prepare('INSERT OR IGNORE INTO tag_taxonomy (tag) VALUES (?)').run(tag);
            const tagRow = this.db.prepare('SELECT id FROM tag_taxonomy WHERE tag = ?').get(tag);
            if (tagRow) {
                this.db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)').run(entryId, tagRow.id);
                this.db.prepare('UPDATE tag_taxonomy SET usage_count = usage_count + 1 WHERE id = ?').run(tagRow.id);
                added++;
            }
        }
        return JSON.stringify({ entry_id: entryId, tags_added: added });
    }
    untagEntry(args) {
        const entryId = args.entry_id;
        const tagsStr = args.tags ?? '';
        if (!entryId || !tagsStr)
            return 'Error: entry_id and tags required';
        const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
        let removed = 0;
        for (const tag of tags) {
            const tagRow = this.db.prepare('SELECT id FROM tag_taxonomy WHERE tag = ?').get(tag);
            if (tagRow) {
                this.db.prepare('DELETE FROM entry_tags WHERE entry_id = ? AND tag_id = ?').run(entryId, tagRow.id);
                this.db.prepare('UPDATE tag_taxonomy SET usage_count = MAX(0, usage_count - 1) WHERE id = ?').run(tagRow.id);
                removed++;
            }
        }
        return JSON.stringify({ entry_id: entryId, tags_removed: removed });
    }
    searchByTags(args) {
        const tagsStr = args.tags ?? '';
        const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
        if (!tags.length)
            return 'Error: tags required for search';
        const operator = args.operator ?? 'AND';
        const limit = args.limit ?? 20;
        const placeholders = tags.map(() => '?').join(',');
        const minCount = operator === 'AND' ? tags.length : 1;
        const rows = this.db.prepare(`SELECT ke.id, ke.summary, ke.type, ke.tier, COUNT(*) as match_count FROM entry_tags et JOIN tag_taxonomy tt ON et.tag_id = tt.id JOIN knowledge_entries ke ON et.entry_id = ke.id WHERE tt.tag IN (${placeholders}) AND ke.archived_at IS NULL GROUP BY ke.id HAVING match_count >= ? ORDER BY match_count DESC LIMIT ?`).all(...tags, minCount, limit);
        return JSON.stringify(rows, null, 2);
    }
    getPopular(args) {
        const limit = args.limit ?? 20;
        const rows = this.db.prepare('SELECT tag, category, usage_count, parent_tag FROM tag_taxonomy ORDER BY usage_count DESC LIMIT ?').all(limit);
        return JSON.stringify(rows, null, 2);
    }
    getEntryTags(args) {
        const entryId = args.entry_id;
        if (!entryId)
            return 'Error: entry_id required';
        const rows = this.db.prepare('SELECT tt.tag, tt.category FROM entry_tags et JOIN tag_taxonomy tt ON et.tag_id = tt.id WHERE et.entry_id = ?').all(entryId);
        return JSON.stringify(rows, null, 2);
    }
    getTaxonomy(args) {
        const category = args.category;
        const rows = category
            ? this.db.prepare('SELECT tag, category, parent_tag, usage_count FROM tag_taxonomy WHERE category = ? ORDER BY tag').all(category)
            : this.db.prepare('SELECT tag, category, parent_tag, usage_count FROM tag_taxonomy ORDER BY category, tag').all();
        return JSON.stringify(rows, null, 2);
    }
}
exports.TagTaxonomy = TagTaxonomy;
//# sourceMappingURL=tag-taxonomy.js.map