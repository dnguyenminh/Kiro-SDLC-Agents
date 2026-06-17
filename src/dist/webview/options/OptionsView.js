"use strict";
/**
 * OptionsView — DOM rendering of interactive option buttons
 * KSA-259
 *
 * Renders option buttons as a flex-wrap list above textarea.
 * Uses event delegation (1 click listener on container).
 * XSS-safe: uses textContent, never innerHTML for option text.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptionsView = void 0;
const types_1 = require("./types");
class OptionsView {
    container;
    announcer = null;
    selectCallback = null;
    parentContainer;
    textarea;
    constructor(parentContainer, textarea) {
        this.parentContainer = parentContainer;
        this.textarea = textarea;
        this.container = this.createContainer();
        this.setupAnnouncer();
    }
    createContainer() {
        const el = document.createElement('div');
        el.className = 'options-container';
        el.setAttribute('role', 'group');
        el.setAttribute('aria-label', 'Response options');
        // Insert before textarea (above it visually)
        this.parentContainer.insertBefore(el, this.textarea);
        // Event delegation: single click listener
        el.addEventListener('click', (e) => this.handleClick(e));
        return el;
    }
    setupAnnouncer() {
        this.announcer = document.getElementById('sr-announcer');
        if (!this.announcer) {
            this.announcer = document.createElement('div');
            this.announcer.id = 'sr-announcer';
            this.announcer.setAttribute('aria-live', 'polite');
            this.announcer.setAttribute('aria-atomic', 'true');
            this.announcer.className = 'sr-only';
            document.body.appendChild(this.announcer);
        }
    }
    announce(message) {
        if (this.announcer) {
            this.announcer.textContent = '';
            requestAnimationFrame(() => {
                if (this.announcer)
                    this.announcer.textContent = message;
            });
        }
    }
    /**
     * Render option buttons into the container.
     * Uses DocumentFragment for batch DOM creation (performance).
     */
    render(options, question) {
        // Clear previous
        this.container.textContent = '';
        // Cap at MAX_OPTIONS
        const capped = options.slice(0, types_1.OPTIONS_CONFIG.MAX_OPTIONS);
        // Batch create with DocumentFragment
        const fragment = document.createDocumentFragment();
        capped.forEach((text, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.setAttribute('type', 'button');
            btn.setAttribute('data-option-index', String(index));
            // XSS-safe: textContent only, truncate if needed
            const safeText = text.slice(0, types_1.OPTIONS_CONFIG.MAX_OPTION_LENGTH);
            btn.textContent = safeText;
            btn.setAttribute('aria-label', `Select option: ${safeText}`);
            btn.setAttribute('tabindex', '0');
            fragment.appendChild(btn);
        });
        this.container.appendChild(fragment);
        this.container.classList.add('visible');
        // Announce question for screen readers
        if (question) {
            this.announce(`${question}. ${capped.length} options available.`);
        }
        else {
            this.announce(`${capped.length} options available.`);
        }
    }
    /**
     * Hide and clear all option buttons.
     */
    hide() {
        this.container.classList.remove('visible');
        this.container.textContent = '';
    }
    /**
     * Register callback for option selection.
     */
    onSelect(cb) {
        this.selectCallback = cb;
    }
    /**
     * Event delegation handler for button clicks.
     */
    handleClick(e) {
        const target = e.target;
        if (target.classList.contains('option-btn')) {
            const text = target.textContent || '';
            if (this.selectCallback && text) {
                this.selectCallback(text);
            }
        }
    }
    /**
     * Get all rendered option buttons.
     */
    getButtons() {
        return Array.from(this.container.querySelectorAll('.option-btn'));
    }
    /**
     * Check if options are currently visible.
     */
    isVisible() {
        return this.container.classList.contains('visible');
    }
    /**
     * Get the container element (for testing).
     */
    getContainer() {
        return this.container;
    }
    /**
     * Focus the first button (for keyboard navigation entry).
     */
    focusFirst() {
        const buttons = this.getButtons();
        if (buttons.length > 0) {
            buttons[0].focus();
        }
    }
    /**
     * Focus the textarea (return focus after dismiss).
     */
    focusTextarea() {
        this.textarea.focus();
    }
    dispose() {
        this.hide();
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
    }
}
exports.OptionsView = OptionsView;
//# sourceMappingURL=OptionsView.js.map