/**
 * KSA-72: Scheduled Review Reminders.
 */
import type Database from 'better-sqlite3';
export declare class ReminderManager {
    private readonly db;
    constructor(db: Database.Database);
    execute(args: Record<string, unknown>): string;
    private schedule;
    private snooze;
    private dismiss;
    private complete;
    private autoScheduleAll;
    private getStats;
    private getDue;
}
//# sourceMappingURL=reminder-manager.d.ts.map