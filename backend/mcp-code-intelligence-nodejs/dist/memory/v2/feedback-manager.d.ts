/**
 * KSA-81: Feedback Loop (Thumbs Up/Down).
 */
import type Database from 'better-sqlite3';
export declare class FeedbackManager {
    private readonly db;
    constructor(db: Database.Database);
    execute(args: Record<string, unknown>): string;
    private submitFeedback;
    private getSummary;
    private getLowRated;
    private getTopRated;
    private updateFeedbackScore;
}
//# sourceMappingURL=feedback-manager.d.ts.map