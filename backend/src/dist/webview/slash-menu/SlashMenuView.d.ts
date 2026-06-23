/**
 * SlashMenuView — DOM rendering for the slash command popup
 * KSA-254
 *
 * Two-section layout: Agents (top) + Steering Rules (bottom)
 * Section headers are non-selectable (BR-08, BR-20)
 * Max height 400px, scrollable (TDD §7)
 */
import type { SlashMenuItem } from './types';
export declare class SlashMenuView {
    private container;
    private menuEl;
    private highlightedIndex;
    private selectableItems;
    constructor(container: HTMLElement);
    /**
     * Render the two-section popup (BR-06: Agents first, Steering second)
     */
    render(agents: SlashMenuItem[], steering: SlashMenuItem[], anchorRect: DOMRect): void;
    /**
     * Update items after filter change (BR-14: hide empty section headers)
     */
    updateItems(agents: SlashMenuItem[], steering: SlashMenuItem[]): void;
    private createSectionHeader;
    private createItemElement;
    private showEmptyState;
    setHighlight(index: number): void;
    /**
     * Move highlight up/down, wrapping at boundaries (BR-18, BR-19)
     * Section headers are automatically skipped (they have no .context-menu-item class)
     */
    moveHighlight(direction: 'up' | 'down'): number;
    getHighlightedItem(): SlashMenuItem | null;
    getItemAtIndex(index: number): SlashMenuItem | null;
    getSelectableCount(): number;
    isVisible(): boolean;
    destroy(): void;
    getElement(): HTMLElement | null;
    private escapeHtml;
}
//# sourceMappingURL=SlashMenuView.d.ts.map