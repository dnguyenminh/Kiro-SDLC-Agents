/**
 * InputAreaIntegration — Wires context menu into the existing input field
 * KSA-252
 */
import { ContextMenuController } from '../context-menu/ContextMenuController';
import type { VsCodeApi } from '../bridge/types';
export interface InputAreaIntegrationOptions {
    inputElement: HTMLElement;
    containerElement: HTMLElement;
    badgeContainer: HTMLElement;
    vscodeApi: VsCodeApi;
}
export declare class InputAreaIntegration {
    private controller;
    private badgeContainer;
    private inputElement;
    private hashDetectionEnabled;
    constructor(options: InputAreaIntegrationOptions);
    private setupListeners;
    private updateFilter;
    private renderBadge;
    private removeHashText;
    private handleBadgeBackspace;
    private onMenuClose;
    getController(): ContextMenuController;
    /**
     * Get all current context badges for message submission
     */
    getResolvedContexts(): Promise<import("../../shared/protocol").ResolvedContext[]>;
    dispose(): void;
}
//# sourceMappingURL=InputAreaIntegration.d.ts.map