"use strict";
/**
 * FolderPicker — Folder tree picker
 * KSA-252
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FolderPicker = void 0;
const PickerPanel_1 = require("./PickerPanel");
class FolderPicker {
    bridge;
    panel = null;
    container;
    onSelect;
    onBack;
    generateId;
    constructor(options) {
        this.bridge = options.bridge;
        this.container = options.container;
        this.onSelect = options.onSelect;
        this.onBack = options.onBack;
        this.generateId = options.generateId;
    }
    async open() {
        let folders;
        try {
            folders = await this.bridge.getFolderTree();
        }
        catch {
            folders = [];
        }
        const items = this.flattenFolders(folders);
        this.panel = new PickerPanel_1.PickerPanel({
            container: this.container,
            title: 'Select Folder',
            items,
            onSelect: (item) => this.handleSelect(item),
            onBack: () => this.close(),
            searchable: true,
            multiSelect: false,
        });
        this.panel.render();
    }
    flattenFolders(nodes, prefix = '') {
        const result = [];
        for (const node of nodes) {
            const relativePath = prefix ? `${prefix}/${node.name}` : node.name;
            result.push({
                id: relativePath,
                label: relativePath,
                path: relativePath,
                type: 'directory',
                icon: '\u{1F4C2}',
            });
            if (node.children) {
                result.push(...this.flattenFolders(node.children, relativePath));
            }
        }
        return result;
    }
    handleSelect(item) {
        const badge = {
            id: this.generateId(),
            type: 'folder',
            label: `Folder: ${item.path || item.label}`,
            icon: '\u{1F4C2}',
            metadata: { folderPath: item.path || item.label },
        };
        this.onSelect(badge);
        this.close();
    }
    handleKeyDown(event) {
        return this.panel?.handleKeyDown(event) ?? false;
    }
    close() {
        this.panel?.destroy();
        this.panel = null;
        this.onBack();
    }
    isVisible() {
        return this.panel?.isVisible() ?? false;
    }
}
exports.FolderPicker = FolderPicker;
//# sourceMappingURL=FolderPicker.js.map