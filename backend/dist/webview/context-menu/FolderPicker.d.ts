/**
 * FolderPicker — Folder tree picker
 * KSA-252
 */
import type { ContextTagBadge } from '../../shared/protocol';
import { MessageBridge } from '../bridge/MessageBridge';
export declare class FolderPicker {
    private bridge;
    private panel;
    private container;
    private onSelect;
    private onBack;
    private generateId;
    constructor(options: {
        bridge: MessageBridge;
        container: HTMLElement;
        onSelect: (badge: ContextTagBadge) => void;
        onBack: () => void;
        generateId: () => string;
    });
    open(): Promise<void>;
    private flattenFolders;
    private handleSelect;
    handleKeyDown(event: KeyboardEvent): boolean;
    close(): void;
    isVisible(): boolean;
}
