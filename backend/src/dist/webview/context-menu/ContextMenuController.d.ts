/**
 * ContextMenuController — State machine + orchestration for Context Menu
 * KSA-252
 */
import type { ContextMenuState, ContextMenuOptions } from './types';
import { BadgeManager } from '../badges/BadgeManager';
import { BadgeRenderer } from '../badges/BadgeRenderer';
import { MessageBridge } from '../bridge/MessageBridge';
export declare class ContextMenuController {
    private state;
    private view;
    private badgeManager;
    private badgeRenderer;
    private bridge;
    private filterText;
    private visibleItems;
    private options;
    private filePicker;
    private folderPicker;
    private listPicker;
    private announcer;
    constructor(options: ContextMenuOptions, bridge: MessageBridge);
    private setupAnnouncer;
    private announce;
    private transition;
    getState(): ContextMenuState;
    open(): void;
    close(): void;
    filter(text: string): void;
    handleKeyDown(event: KeyboardEvent): boolean;
    handleItemClick(index: number): void;
    private selectHighlighted;
    private selectItem;
    private selectInstant;
    private openPicker;
    private createInstantBadge;
    private insertBadge;
    private removeBadge;
    getBadgeManager(): BadgeManager;
    getBadgeRenderer(): BadgeRenderer;
    isOpen(): boolean;
    dispose(): void;
}
//# sourceMappingURL=ContextMenuController.d.ts.map