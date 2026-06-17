/**
 * NotificationManager — shows user-facing error/warning notifications.
 * Implements TDD §5.6 Error Handling Strategy.
 */
export declare class NotificationManager {
    showError(message: string, ...actions: string[]): Thenable<string | undefined>;
    showWarning(message: string, ...actions: string[]): Thenable<string | undefined>;
    showInfo(message: string): Thenable<string | undefined>;
}
//# sourceMappingURL=NotificationManager.d.ts.map