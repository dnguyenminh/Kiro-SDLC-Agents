"use strict";
/**
 * InputAreaIntegration — Wires context menu into the existing input field
 * KSA-252
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputAreaIntegration = void 0;
const ContextMenuController_1 = require("../context-menu/ContextMenuController");
const BadgeRenderer_1 = require("../badges/BadgeRenderer");
const MessageBridge_1 = require("../bridge/MessageBridge");
class InputAreaIntegration {
    controller;
    badgeContainer;
    inputElement;
    hashDetectionEnabled = true;
    constructor(options) {
        this.inputElement = options.inputElement;
        this.badgeContainer = options.badgeContainer;
        const bridge = new MessageBridge_1.MessageBridge(options.vscodeApi);
        this.controller = new ContextMenuController_1.ContextMenuController({
            container: options.containerElement,
            inputElement: options.inputElement,
            onBadgeInsert: (badge) => this.renderBadge(badge),
            onClose: () => this.onMenuClose(),
        }, bridge);
        this.setupListeners();
    }
    setupListeners() {
        // Detect "#" typed in input
        this.inputElement.addEventListener('input', (e) => {
            if (!this.hashDetectionEnabled)
                return;
            const event = e;
            if (event.data === '#' && !this.controller.isOpen()) {
                this.controller.open();
            }
            else if (this.controller.isOpen()) {
                this.updateFilter();
            }
        });
        // Key events for menu navigation
        this.inputElement.addEventListener('keydown', (e) => {
            if (this.controller.isOpen()) {
                const handled = this.controller.handleKeyDown(e);
                if (handled) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });
        // Outside click detection
        document.addEventListener('mousedown', (e) => {
            if (!this.controller.isOpen())
                return;
            const target = e.target;
            if (!target.closest('.context-menu') && !target.closest('.picker-panel')) {
                this.controller.close();
            }
        });
        // Badge backspace removal
        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !this.controller.isOpen()) {
                this.handleBadgeBackspace();
            }
        });
    }
    updateFilter() {
        // Extract text after the last "#"
        const text = this.inputElement.textContent || '';
        const lastHash = text.lastIndexOf('#');
        if (lastHash >= 0) {
            const filterText = text.substring(lastHash + 1);
            this.controller.filter(filterText);
        }
    }
    renderBadge(badge) {
        const renderer = this.controller.getBadgeRenderer();
        const el = renderer.createBadgeElement(badge);
        this.badgeContainer.appendChild(el);
        // Remove "#..." text from input
        this.removeHashText();
    }
    removeHashText() {
        const text = this.inputElement.textContent || '';
        const lastHash = text.lastIndexOf('#');
        if (lastHash >= 0) {
            this.inputElement.textContent = text.substring(0, lastHash);
        }
    }
    handleBadgeBackspace() {
        // If cursor is at the beginning or adjacent to badge, remove last badge
        const badges = this.controller.getBadgeManager().getAll();
        if (badges.length > 0) {
            const selection = window.getSelection();
            if (selection && selection.anchorOffset === 0) {
                const lastBadge = badges[badges.length - 1];
                this.controller.getBadgeManager().remove(lastBadge.id);
                BadgeRenderer_1.BadgeRenderer.removeBadgeElement(this.badgeContainer, lastBadge.id);
            }
        }
    }
    onMenuClose() {
        this.inputElement.focus();
    }
    getController() {
        return this.controller;
    }
    /**
     * Get all current context badges for message submission
     */
    async getResolvedContexts() {
        return this.controller.getBadgeManager().resolveAll();
    }
    dispose() {
        this.controller.dispose();
    }
}
exports.InputAreaIntegration = InputAreaIntegration;
//# sourceMappingURL=InputAreaIntegration.js.map