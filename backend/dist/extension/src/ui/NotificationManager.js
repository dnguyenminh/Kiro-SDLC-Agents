/**
 * NotificationManager — shows user-facing error/warning notifications.
 * Implements TDD §5.6 Error Handling Strategy.
 */
import * as vscode from 'vscode';
export class NotificationManager {
    showError(message, ...actions) {
        return vscode.window.showErrorMessage('Code Intel: ' + message, ...actions);
    }
    showWarning(message, ...actions) {
        return vscode.window.showWarningMessage('Code Intel: ' + message, ...actions);
    }
    showInfo(message) {
        return vscode.window.showInformationMessage('Code Intel: ' + message);
    }
}
//# sourceMappingURL=NotificationManager.js.map