/**
 * SpinnerController — State machine for processing indicator
 * KSA-255
 *
 * Pattern: Mirrors ContextMenuController (KSA-252)
 * States: READY ↔ PROCESSING
 * Transitions are idempotent (BR-08)
 */
import { SPINNER_TRANSITIONS, SPINNER_CONFIG } from './types';
export class SpinnerController {
    state = 'READY';
    startedAt = null;
    timeoutId = null;
    view;
    announcer = null;
    onTimeout;
    constructor(view, onTimeout) {
        this.view = view;
        this.onTimeout = onTimeout;
        this.setupAnnouncer();
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
    transition(trigger) {
        const valid = SPINNER_TRANSITIONS.find(t => t.from === this.state && t.trigger === trigger);
        if (!valid)
            return false;
        this.state = valid.to;
        return true;
    }
    getState() {
        return this.state;
    }
    isProcessing() {
        return this.state === 'PROCESSING';
    }
    startProcessing() {
        // Guard: already processing → no-op (BR-08)
        if (!this.transition('START'))
            return;
        this.startedAt = Date.now();
        // Start timeout (BR-05: 60s max)
        this.timeoutId = setTimeout(() => {
            this.stopProcessing('timeout');
            this.onTimeout?.();
        }, SPINNER_CONFIG.TIMEOUT_MS);
        // Show UI
        this.view.show();
        this.announce('AI is processing your request');
    }
    stopProcessing(reason = 'complete') {
        // Guard: not processing → no-op (BR-08)
        if (!this.transition('STOP'))
            return;
        // Clear timeout
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.startedAt = null;
        // Hide UI
        this.view.hide();
        // Announce reason
        const message = reason === 'timeout'
            ? 'Request timed out'
            : reason === 'error'
                ? 'An error occurred'
                : reason === 'cancelled'
                    ? 'Processing cancelled'
                    : 'AI response complete';
        this.announce(message);
    }
    dispose() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.state = 'READY';
        this.startedAt = null;
    }
}
//# sourceMappingURL=SpinnerController.js.map