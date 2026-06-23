"use strict";
/**
 * ListPicker — Simple list picker for Spec, Steering, MCP
 * KSA-252
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListPicker = void 0;
const PickerPanel_1 = require("./PickerPanel");
class ListPicker {
    bridge;
    panel = null;
    container;
    onSelect;
    onBack;
    generateId;
    sourceType;
    constructor(options) {
        this.bridge = options.bridge;
        this.container = options.container;
        this.sourceType = options.sourceType;
        this.onSelect = options.onSelect;
        this.onBack = options.onBack;
        this.generateId = options.generateId;
    }
    async open() {
        let items;
        switch (this.sourceType) {
            case 'spec':
                items = await this.loadSpecs();
                break;
            case 'steering':
                items = await this.loadSteering();
                break;
            case 'mcp':
                items = await this.loadMcp();
                break;
            default:
                items = [];
        }
        this.panel = new PickerPanel_1.PickerPanel({
            container: this.container,
            title: this.getTitle(),
            items,
            onSelect: (item) => this.handleSelect(item),
            onBack: () => this.close(),
            searchable: true,
            multiSelect: false,
        });
        this.panel.render();
    }
    getTitle() {
        switch (this.sourceType) {
            case 'spec': return 'Select Spec';
            case 'steering': return 'Select Steering File';
            case 'mcp': return 'Select MCP Resource';
            default: return 'Select Item';
        }
    }
    async loadSpecs() {
        try {
            const specs = await this.bridge.getSpecList();
            return specs.map(name => ({
                id: name,
                label: name,
                icon: '\u{1F4C4}',
            }));
        }
        catch {
            return [];
        }
    }
    async loadSteering() {
        try {
            const files = await this.bridge.getSteeringFiles();
            return files.map(name => ({
                id: name,
                label: name.replace(/\.md$/, ''),
                icon: '\u{1F3AF}',
            }));
        }
        catch {
            return [];
        }
    }
    async loadMcp() {
        try {
            const resources = await this.bridge.getMcpResources();
            return resources.map((r) => ({
                id: `${r.server}:${r.name}`,
                label: r.name,
                description: `${r.server} - ${r.type}`,
                icon: '\u{1F48E}',
            }));
        }
        catch {
            return [];
        }
    }
    handleSelect(item) {
        const badge = this.createBadge(item);
        this.onSelect(badge);
        this.close();
    }
    createBadge(item) {
        switch (this.sourceType) {
            case 'spec':
                return {
                    id: this.generateId(),
                    type: 'spec',
                    label: `Spec: ${item.label}`,
                    icon: '\u{1F4C4}',
                    metadata: { specName: item.id },
                };
            case 'steering':
                return {
                    id: this.generateId(),
                    type: 'steering',
                    label: `Steering: ${item.label}`,
                    icon: '\u{1F3AF}',
                    metadata: { steeringFile: item.id },
                };
            case 'mcp': {
                const [server, ...rest] = item.id.split(':');
                return {
                    id: this.generateId(),
                    type: 'mcp',
                    label: `MCP: ${item.label}`,
                    icon: '\u{1F48E}',
                    metadata: { mcpServer: server, mcpResource: rest.join(':') },
                };
            }
            default:
                return {
                    id: this.generateId(),
                    type: this.sourceType,
                    label: item.label,
                    icon: '',
                    metadata: {},
                };
        }
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
exports.ListPicker = ListPicker;
//# sourceMappingURL=ListPicker.js.map