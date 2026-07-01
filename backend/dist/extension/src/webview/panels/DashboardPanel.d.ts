/**
 * DashboardPanel — summary metrics webview.
 * Implements TDD §5.1 panels/DashboardPanel.ts, FSD UC-5.
 */
import * as vscode from 'vscode';
import { WebviewDataFetcher } from '../WebviewDataFetcher';
export interface DashboardData {
    totalEntries: number;
    recentCount: number;
    topCategories: Array<{
        name: string;
        count: number;
    }>;
    modulesReady: boolean;
}
export declare class DashboardPanel {
    private panel;
    private readonly dataFetcher;
    constructor(dataFetcher: WebviewDataFetcher, _extensionUri: vscode.Uri);
    show(): void;
    refresh(): Promise<void>;
    close(): void;
    private getHtml;
}
