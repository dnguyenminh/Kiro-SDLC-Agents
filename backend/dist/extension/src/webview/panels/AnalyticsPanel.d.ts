/**
 * AnalyticsPanel — analytics and quality overview webview.
 * Implements TDD §5.1 panels/AnalyticsPanel.ts, FSD UC-5.
 */
import * as vscode from 'vscode';
import { WebviewDataFetcher } from '../WebviewDataFetcher';
export interface AnalyticsData {
    totalQueries: number;
    avgLatency: number;
    topTools: Array<{
        name: string;
        count: number;
    }>;
}
export declare class AnalyticsPanel {
    private panel;
    private readonly dataFetcher;
    constructor(dataFetcher: WebviewDataFetcher, _extensionUri: vscode.Uri);
    show(): void;
    refresh(): Promise<void>;
    close(): void;
    private getHtml;
}
