/**
 * InputAreaIntegration — Wires context menu + spinner + options + slash menu into the existing input field
 * KSA-252: Context Menu
 * KSA-254: Slash Command Menu
 * KSA-255: Spinner + Working Indicator
 * KSA-259: Interactive Options
 */
import { ContextMenuController } from '../context-menu/ContextMenuController';
import { SlashMenuController } from '../slash-menu/SlashMenuController';
import { SpinnerController } from '../spinner/SpinnerController';
import { OptionsController } from '../options/OptionsController';
import type { VsCodeApi } from '../bridge/types';
export interface InputAreaIntegrationOptions {
    inputElement: HTMLElement;
    containerElement: HTMLElement;
    badgeContainer: HTMLElement;
    vscodeApi: VsCodeApi;
}
export declare class InputAreaIntegration {
    private controller;
    private slashController;
    private spinnerController;
    private spinnerView;
    private optionsController;
    private optionsView;
    private badgeContainer;
    private inputElement;
    private hashDetectionEnabled;
    private vscodeApi;
    constructor(options: InputAreaIntegrationOptions);
    private setupListeners;
    /**
     * KSA-255: Listen for processing signals from Extension Host.
     * Handles BOTH protocols:
     * - chat:processing (original KSA-255 spec: { state: 'start'|'stop', reason })
     * - chat:workingStatus (actual backend emission: { working: true|false })
     */
    private setupProcessingListener;
    /**
     * KSA-259: Listen for chat:options signals from Extension Host
     */
    private setupOptionsListener;
    /**
     * KSA-254: Listen for chat:steeringLoaded signal from Extension Host
     */
    private setupSteeringListener;
    /**
     * KSA-254: Agent selected — insert /agent-name prefix into textarea (BR-24, BR-25)
     */
    private onAgentSelected;
    /**
     * KSA-254: Steering rule selected — add context chip (BR-28, BR-29)
     */
    private onSteeringSelected;
    /**
     * KSA-254: Update slash menu filter based on text after trigger position
     */
    private updateSlashFilter;
    private setCursorPosition;
    /**
     * KSA-259: Handle option selection — send response to Extension Host
     */
    private handleOptionSelect;
    /**
     * KSA-259: Called when user submits text from textarea
     * Dismisses options if visible
     */
    handleTextSubmit(): void;
    /**
     * KSA-255: Handle Stop button click — optimistic reset (BR-04)
     */
    handleStopClick(): void;
    /**
     * KSA-255: Timeout notification
     */
    private showTimeoutNotification;
    private updateFilter;
    private renderBadge;
    private removeHashText;
    private handleBadgeBackspace;
    private onMenuClose;
    getController(): ContextMenuController;
    getSpinnerController(): SpinnerController;
    getOptionsController(): OptionsController;
    getSlashController(): SlashMenuController;
    getResolvedContexts(): Promise<import("../../shared/protocol").ResolvedContext[]>;
    dispose(): void;
}
