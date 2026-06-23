/**
 * NotificationManager — user notifications for errors/warnings.
 */

import * as vscode from 'vscode';

export class NotificationManager {
  showError(message: string, ...actions: string[]): Thenable<string | undefined> {
    return vscode.window.showErrorMessage(`Code Intelligence: ${message}`, ...actions);
  }

  showWarning(message: string, ...actions: string[]): Thenable<string | undefined> {
    return vscode.window.showWarningMessage(`Code Intelligence: ${message}`, ...actions);
  }

  showInfo(message: string): Thenable<string | undefined> {
    return vscode.window.showInformationMessage(`Code Intelligence: ${message}`);
  }
}
