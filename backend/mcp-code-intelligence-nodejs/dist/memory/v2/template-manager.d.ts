/**
 * KSA-73: Template Enforcement Engine.
 */
import type Database from 'better-sqlite3';
export declare class TemplateManager {
    private readonly db;
    constructor(db: Database.Database);
    execute(args: Record<string, unknown>): string;
    private createTemplate;
    private validateEntry;
    private listTemplates;
}
//# sourceMappingURL=template-manager.d.ts.map