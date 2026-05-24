/**
 * KSA-75: File Attachments for knowledge entries.
 */
import type Database from 'better-sqlite3';
export declare class AttachmentManager {
    private readonly db;
    constructor(db: Database.Database);
    execute(args: Record<string, unknown>): string;
    private attach;
    private remove;
    private searchByType;
    private listAttachments;
}
//# sourceMappingURL=attachment-manager.d.ts.map