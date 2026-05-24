/**
 * KSA-77: Faceted Search with Tag Taxonomy.
 */
import type Database from 'better-sqlite3';
export declare class TagTaxonomy {
    private readonly db;
    constructor(db: Database.Database);
    execute(args: Record<string, unknown>): string;
    private createTag;
    private tagEntry;
    private untagEntry;
    private searchByTags;
    private getPopular;
    private getEntryTags;
    private getTaxonomy;
}
//# sourceMappingURL=tag-taxonomy.d.ts.map