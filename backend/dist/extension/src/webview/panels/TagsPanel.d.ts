/**
 * TagsPanel — tag management webview with CRUD operations.
 * Implements TDD §5.1 panels/TagsPanel.ts, FSD UC-5.
 */
import * as vscode from 'vscode';
import { WebviewDataFetcher } from '../WebviewDataFetcher';
export interface TagData {
    id: string;
    name: string;
    count: number;
}
export declare class TagsPanel {
    private panel;
    private readonly dataFetcher;
    constructor(dataFetcher: WebviewDataFetcher, _extensionUri: vscode.Uri);
    show(): void;
    refresh(): Promise<void>;
    close(): void;
    private createTag;
    private deleteTag;
    private getHtml;
}
