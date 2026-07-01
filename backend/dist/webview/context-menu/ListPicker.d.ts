/**
 * ListPicker — Simple list picker for Spec, Steering, MCP
 * KSA-252
 */
import type { ContextTagBadge, ContextSourceType } from '../../shared/protocol';
import { MessageBridge } from '../bridge/MessageBridge';
export declare class ListPicker {
    private bridge;
    private panel;
    private container;
    private onSelect;
    private onBack;
    private generateId;
    private sourceType;
    constructor(options: {
        bridge: MessageBridge;
        container: HTMLElement;
        sourceType: ContextSourceType;
        onSelect: (badge: ContextTagBadge) => void;
        onBack: () => void;
        generateId: () => string;
    });
    open(): Promise<void>;
    private getTitle;
    private loadSpecs;
    private loadSteering;
    private loadMcp;
    private handleSelect;
    private createBadge;
    handleKeyDown(event: KeyboardEvent): boolean;
    close(): void;
    isVisible(): boolean;
}
