"use strict";
/**
 * FilePicker — File tree picker with fuzzy search
 * KSA-252
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilePicker = void 0;
const PickerPanel_1 = require("./PickerPanel");
class FilePicker {
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
        let files;
        try {
            files = await this.bridge.getFileTree();
        }
        catch {
            files = [];
        }
        const items = this.flattenTree(files);
        this.panel = new PickerPanel_1.PickerPanel({
            container: this.container,
            title: 'Select Files',
            items,
            onSelect: (item) => this.handleSelect(item),
            onBack: () => this.close(),
            searchable: true,
            multiSelect: true,
        });
        this.panel.render();
    }
    flattenTree(nodes, prefix = '') {
        const result = [];
        for (const node of nodes) {
            const relativePath = prefix ? `${prefix}/${node.name}` : node.name;
            if (node.type === 'file') {
                result.push({
                    id: relativePath,
                    label: node.name,
                    path: relativePath,
                    type: 'file',
                    icon: '\u{1F4C4}',
                });
            }
            if (node.children) {
                result.push(...this.flattenTree(node.children, relativePath));
            }
        }
        return result;
    }
    handleSelect(item) {
        const badge = {
            id: this.generateId(),
            type: 'files',
            label: `File: ${item.path || item.label}`,
            icon: '\u{1F4C1}',
            metadata: { filePaths: [item.path || item.label] },
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
exports.FilePicker = FilePicker;
//# sourceMappingURL=FilePicker.js.map