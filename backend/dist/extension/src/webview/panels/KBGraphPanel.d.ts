/**
 * KBGraphPanel — Knowledge Base graph visualization webview.
 * Implements TDD §5.1 panels/KBGraphPanel.ts, FSD UC-5.
 */
import * as vscode from 'vscode';
import { WebviewDataFetcher } from '../WebviewDataFetcher';
export interface KBGraphData {
    nodes: Array<{
        id: string;
        title: string;
        tags: string[];
    }>;
    edges: Array<{
        source: string;
        target: string;
        relation: string;
    }>;
}
export declare class KBGraphPanel {
    private panel;
    private readonly dataFetcher;
    constructor(dataFetcher: WebviewDataFetcher, _extensionUri: vscode.Uri);
    show(): void;
    refresh(): Promise<void>;
    close(): void;
    private loadNodeDetail;
    private getHtml;
}
