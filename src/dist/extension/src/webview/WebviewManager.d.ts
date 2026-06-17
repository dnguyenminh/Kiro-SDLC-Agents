/**
 * WebviewManager — manages Webview panel lifecycle and data loading.
 * Implements TDD §5.3 IWebviewManager, FSD BR-22, BR-23, BR-24, BR-25.
 */
import * as vscode from 'vscode';
import { PanelType } from '../types/config';
import { ConnectionManager } from '../connection/ConnectionManager';
export interface IWebviewManager {
    openPanel(panelId: PanelType): void;
    closePanel(panelId: PanelType): void;
    refreshPanel(panelId: PanelType): void;
}
export declare class WebviewManager implements IWebviewManager, vscode.Disposable {
    private readonly panels;
    private readonly dataFetcher;
    private readonly extensionUri;
    private readonly disposables;
    constructor(connectionManager: ConnectionManager, extensionUri: vscode.Uri);
    openPanel(panelId: PanelType): void;
    closePanel(panelId: PanelType): void;
    refreshPanel(panelId: PanelType): Promise<void>;
    private refreshAllPanels;
    private getWebviewHtml;
    dispose(): void;
}
//# sourceMappingURL=WebviewManager.d.ts.map