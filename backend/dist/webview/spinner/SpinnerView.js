/**
 * SpinnerView — DOM rendering for spinner + working text
 * KSA-255
 */
export class SpinnerView {
    container;
    spinnerEl = null;
    textarea;
    originalPlaceholder;
    constructor(container, textarea) {
        this.container = container;
        this.textarea = textarea;
        this.originalPlaceholder = textarea.placeholder || textarea.getAttribute('data-placeholder') || 'Type a message...';
    }
    show() {
        if (this.spinnerEl)
            return;
        this.spinnerEl = document.createElement('div');
        this.spinnerEl.className = 'spinner-container visible';
        const icon = document.createElement('div');
        icon.className = 'spinner-icon';
        const text = document.createElement('span');
        text.className = 'spinner-text';
        text.textContent = 'working';
        this.spinnerEl.appendChild(icon);
        this.spinnerEl.appendChild(text);
        this.container.appendChild(this.spinnerEl);
        // Disable textarea
        if ('disabled' in this.textarea) {
            this.textarea.disabled = true;
            this.textarea.placeholder = '';
        }
        else {
            this.textarea.setAttribute('contenteditable', 'false');
        }
    }
    hide() {
        if (this.spinnerEl && this.spinnerEl.parentElement) {
            this.spinnerEl.parentElement.removeChild(this.spinnerEl);
        }
        this.spinnerEl = null;
        // Re-enable textarea
        if ('disabled' in this.textarea) {
            this.textarea.disabled = false;
            this.textarea.placeholder = this.originalPlaceholder;
        }
        else {
            this.textarea.setAttribute('contenteditable', 'true');
        }
        this.textarea.focus();
    }
    isVisible() {
        return this.spinnerEl !== null;
    }
    getElement() {
        return this.spinnerEl;
    }
}
//# sourceMappingURL=SpinnerView.js.map