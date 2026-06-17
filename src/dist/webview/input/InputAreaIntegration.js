"use strict";
/**
 * InputAreaIntegration — Wires context menu + spinner + options + slash menu into the existing input field
 * KSA-252: Context Menu
 * KSA-254: Slash Command Menu
 * KSA-255: Spinner + Working Indicator
 * KSA-259: Interactive Options
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputAreaIntegration = void 0;
const ContextMenuController_1 = require("../context-menu/ContextMenuController");
const SlashMenuController_1 = require("../slash-menu/SlashMenuController");
const SpinnerController_1 = require("../spinner/SpinnerController");
const SpinnerView_1 = require("../spinner/SpinnerView");
const OptionsController_1 = require("../options/OptionsController");
const OptionsView_1 = require("../options/OptionsView");
const BadgeRenderer_1 = require("../badges/BadgeRenderer");
const MessageBridge_1 = require("../bridge/MessageBridge");
class InputAreaIntegration {
    controller;
    slashController;
    spinnerController;
    spinnerView;
    optionsController;
    optionsView;
    badgeContainer;
    inputElement;
    hashDetectionEnabled = true;
    vscodeApi;
    constructor(options) {
        this.inputElement = options.inputElement;
        this.badgeContainer = options.badgeContainer;
        this.vscodeApi = options.vscodeApi;
        const bridge = new MessageBridge_1.MessageBridge(options.vscodeApi);
        // Context Menu (KSA-252)
        this.controller = new ContextMenuController_1.ContextMenuController({
            container: options.containerElement,
            inputElement: options.inputElement,
            onBadgeInsert: (badge) => this.renderBadge(badge),
            onClose: () => this.onMenuClose(),
        }, bridge);
        // Spinner (KSA-255)
        this.spinnerView = new SpinnerView_1.SpinnerView(options.containerElement, options.inputElement);
        this.spinnerController = new SpinnerController_1.SpinnerController(this.spinnerView, () => {
            this.showTimeoutNotification();
        });
        // Slash Menu (KSA-254)
        this.slashController = new SlashMenuController_1.SlashMenuController({
            container: options.containerElement,
            inputElement: options.inputElement,
            onAgentSelect: (agentName) => this.onAgentSelected(agentName),
            onSteeringSelect: (rule) => this.onSteeringSelected(rule),
            onClose: () => this.onMenuClose(),
        });
        // Options (KSA-259)
        this.optionsView = new OptionsView_1.OptionsView(options.containerElement, options.inputElement);
        this.optionsController = new OptionsController_1.OptionsController({
            view: this.optionsView,
            onSelect: (text, source) => this.handleOptionSelect(text, source),
            isSpinnerActive: () => this.spinnerController.isProcessing(),
        });
        this.setupListeners();
        this.setupProcessingListener();
        this.setupOptionsListener();
        this.setupSteeringListener();
    }
    setupListeners() {
        // Detect "#" or "/" typed in input
        this.inputElement.addEventListener('input', (e) => {
            const event = e;
            const text = this.inputElement.textContent || '';
            // KSA-254: Detect '/' trigger (BR-01, BR-02, BR-04)
            if (event.data === '/' && !this.slashController.isOpen() && !this.controller.isOpen()) {
                const slashPos = text.lastIndexOf('/');
                if (slashPos >= 0 && this.slashController.isValidTrigger(text, slashPos)) {
                    this.slashController.open(slashPos);
                    return;
                }
            }
            else if (this.slashController.isOpen()) {
                this.updateSlashFilter();
                return;
            }
            // KSA-252: Detect '#' trigger
            if (!this.hashDetectionEnabled)
                return;
            if (event.data === '#' && !this.controller.isOpen()) {
                this.controller.open();
            }
            else if (this.controller.isOpen()) {
                this.updateFilter();
            }
        });
        // Key events for menu navigation + options navigation
        this.inputElement.addEventListener('keydown', (e) => {
            const ke = e;
            // Options keyboard handling first (KSA-259)
            if (this.optionsController.isVisible()) {
                const handled = this.optionsController.handleKeyDown(ke);
                if (handled) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
            // KSA-254: Slash menu keyboard handling
            if (this.slashController.isOpen()) {
                const handled = this.slashController.handleKeyDown(ke);
                if (handled) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
            // Context menu keyboard handling (KSA-252)
            if (this.controller.isOpen()) {
                const handled = this.controller.handleKeyDown(ke);
                if (handled) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });
        // Outside click detection
        document.addEventListener('mousedown', (e) => {
            const target = e.target;
            // KSA-254: Close slash menu on outside click
            if (this.slashController.isOpen()) {
                if (!target.closest('.slash-menu')) {
                    this.slashController.close();
                }
            }
            // KSA-252: Close context menu on outside click
            if (this.controller.isOpen()) {
                if (!target.closest('.context-menu') && !target.closest('.picker-panel')) {
                    this.controller.close();
                }
            }
        });
        // Badge backspace removal
        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !this.controller.isOpen() && !this.slashController.isOpen()) {
                this.handleBadgeBackspace();
            }
        });
    }
    /**
     * KSA-255: Listen for processing signals from Extension Host.
     * Handles BOTH protocols:
     * - chat:processing (original KSA-255 spec: { state: 'start'|'stop', reason })
     * - chat:workingStatus (actual backend emission: { working: true|false })
     */
    setupProcessingListener() {
        window.addEventListener('message', (event) => {
            const message = event.data;
            // Handle chat:processing (original protocol from KSA-255 spec)
            if (message && message.type === 'chat:processing') {
                if (message.state === 'start') {
                    this.spinnerController.startProcessing();
                    // KSA-259: Auto-dismiss options when processing starts
                    if (this.optionsController.isVisible()) {
                        this.optionsController.dismiss('auto-dismiss');
                    }
                }
                else if (message.state === 'stop') {
                    this.spinnerController.stopProcessing(message.reason ?? 'complete');
                    // KSA-259: Show pending options after spinner stops
                    this.optionsController.processPendingOptions();
                }
            }
            // Handle chat:workingStatus (actual protocol from backend message-handler)
            if (message && message.type === 'chat:workingStatus') {
                if (message.working) {
                    this.spinnerController.startProcessing();
                    // KSA-259: Auto-dismiss options when processing starts
                    if (this.optionsController.isVisible()) {
                        this.optionsController.dismiss('auto-dismiss');
                    }
                }
                else {
                    this.spinnerController.stopProcessing('complete');
                    // KSA-259: Show pending options after spinner stops
                    this.optionsController.processPendingOptions();
                }
            }
        });
    }
    /**
     * KSA-259: Listen for chat:options signals from Extension Host
     */
    setupOptionsListener() {
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message && message.type === 'chat:options') {
                this.optionsController.showOptions(message);
            }
        });
    }
    /**
     * KSA-254: Listen for chat:steeringLoaded signal from Extension Host
     */
    setupSteeringListener() {
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message && message.type === 'chat:steeringLoaded' && Array.isArray(message.rules)) {
                this.slashController.setSteeringRules(message.rules);
            }
        });
    }
    /**
     * KSA-254: Agent selected — insert /agent-name prefix into textarea (BR-24, BR-25)
     */
    onAgentSelected(agentName) {
        const text = this.inputElement.textContent || '';
        const triggerIndex = this.slashController.getTriggerIndex();
        const before = text.substring(0, triggerIndex);
        const cursorPos = (window.getSelection()?.anchorOffset) ?? text.length;
        const after = text.substring(cursorPos);
        const prefix = `/${agentName} `;
        this.inputElement.textContent = before + prefix + after;
        // Move cursor after prefix
        this.setCursorPosition(before.length + prefix.length);
    }
    /**
     * KSA-254: Steering rule selected — add context chip (BR-28, BR-29)
     */
    onSteeringSelected(rule) {
        const text = this.inputElement.textContent || '';
        const triggerIndex = this.slashController.getTriggerIndex();
        const before = text.substring(0, triggerIndex);
        const cursorPos = (window.getSelection()?.anchorOffset) ?? text.length;
        const after = text.substring(cursorPos);
        this.inputElement.textContent = before + after;
        this.setCursorPosition(before.length);
        // Add as context chip via badge system
        const badge = {
            id: `slash-steering-${Date.now()}`,
            type: 'steering',
            label: rule.name,
            icon: rule.icon,
            metadata: { steeringFile: `.kiro/steering/${rule.file}` },
        };
        this.renderBadge(badge);
    }
    /**
     * KSA-254: Update slash menu filter based on text after trigger position
     */
    updateSlashFilter() {
        const text = this.inputElement.textContent || '';
        const triggerIndex = this.slashController.getTriggerIndex();
        if (triggerIndex < 0)
            return;
        // Extract filter text: everything between '/' trigger and cursor
        const filterText = text.substring(triggerIndex + 1);
        // BR-17: If user backspaced past the '/' position, close
        if (!text.includes('/') || text.length <= triggerIndex) {
            this.slashController.close();
            return;
        }
        this.slashController.filter(filterText);
    }
    setCursorPosition(pos) {
        const range = document.createRange();
        const sel = window.getSelection();
        const textNode = this.inputElement.firstChild;
        if (textNode) {
            const safePos = Math.min(pos, textNode.textContent?.length ?? 0);
            range.setStart(textNode, safePos);
            range.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
    }
    /**
     * KSA-259: Handle option selection — send response to Extension Host
     */
    handleOptionSelect(text, source) {
        this.vscodeApi.postMessage({
            type: 'chat:response',
            text,
            source,
        });
    }
    /**
     * KSA-259: Called when user submits text from textarea
     * Dismisses options if visible
     */
    handleTextSubmit() {
        if (this.optionsController.isVisible()) {
            this.optionsController.submitCustom();
        }
    }
    /**
     * KSA-255: Handle Stop button click — optimistic reset (BR-04)
     */
    handleStopClick() {
        this.spinnerController.stopProcessing('cancelled');
        this.vscodeApi.postMessage({ type: 'chat:cancel' });
    }
    /**
     * KSA-255: Timeout notification
     */
    showTimeoutNotification() {
        this.vscodeApi.postMessage({ type: 'chat:timeout-notification' });
    }
    updateFilter() {
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
    getSpinnerController() {
        return this.spinnerController;
    }
    getOptionsController() {
        return this.optionsController;
    }
    getSlashController() {
        return this.slashController;
    }
    async getResolvedContexts() {
        return this.controller.getBadgeManager().resolveAll();
    }
    dispose() {
        this.controller.dispose();
        this.slashController.dispose();
        this.spinnerController.dispose();
        this.optionsController.dispose();
    }
}
exports.InputAreaIntegration = InputAreaIntegration;
//# sourceMappingURL=InputAreaIntegration.js.map