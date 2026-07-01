/**
 * ContextMenuView — DOM rendering for the context menu popup
 * KSA-252
 */
import type { ContextMenuItem } from '../../shared/protocol';
export declare class ContextMenuView {
    private container;
    private menuEl;
    private itemEls;
    private highlightedIndex;
    private visibleItems;
    constructor(container: HTMLElement);
    render(items: ContextMenuItem[], anchorRect: DOMRect): void;
    private createItemElement;
    updateItems(items: ContextMenuItem[]): void;
    private showEmptyState;
    setHighlight(index: number): void;
    moveHighlight(direction: 'up' | 'down'): number;
    getHighlightedItem(): ContextMenuItem | null;
    getItemAtIndex(index: number): ContextMenuItem | null;
    isVisible(): boolean;
    destroy(): void;
    getElement(): HTMLElement | null;
    private escapeHtml;
}
