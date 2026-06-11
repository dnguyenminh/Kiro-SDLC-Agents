/**
 * NotificationManager — shows user-facing error/warning notifications.
 * Implements TDD §5.6 Error Handling Strategy.
 */

import * as vscode from 'vscode';

export class NotificationManager {
  showError(message: string, ...actions: string[]): Thenable<string | undefined> {
    return vscode.window.showErrorMessage('Code Intel: ' + message, ...actions);
  }

  showWarning(message: string, ...actions: string[]): Thenable<string | undefined> {
    return vscode.window.showWarningMessage('Code Intel: ' + message, ...actions);
  }

  showInfo(message: string): Thenable<string | undefined> {
    return vscode.window.showInformationMessage('Code Intel: ' + message);
  }
}
