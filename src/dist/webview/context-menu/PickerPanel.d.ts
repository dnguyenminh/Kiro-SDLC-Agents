/**
 * PickerPanel — Base panel renderer for secondary pickers
 * KSA-252
 */
import type { PickerItem } from './types';
export interface PickerPanelOptions {
    container: HTMLElement;
    title: string;
    items: PickerItem[];
    onSelect: (item: PickerItem) => void;
    onBack: () => void;
    searchable?: boolean;
    multiSelect?: boolean;
}
export declare class PickerPanel {
    private container;
    private panelEl;
    private items;
    private filteredItems;
    private highlightIndex;
    private onSelect;
    private onBack;
    private searchable;
    private multiSelect;
    private selectedIds;
    private searchInput;
    constructor(options: PickerPanelOptions);
    render(): void;
    private renderItems;
    private filterList;
    private toggleSelection;
    private confirmSelection;
    handleKeyDown(event: KeyboardEvent): boolean;
    private updateHighlight;
    destroy(): void;
    isVisible(): boolean;
    private escapeHtml;
}
//# sourceMappingURL=PickerPanel.d.ts.map