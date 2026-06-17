/**
 * OptionsController — State management + event coordination for Interactive Options
 * KSA-259
 *
 * Pattern: Mirrors SpinnerController (KSA-255) — state machine with guard clauses.
 * States: IDLE <-> OPTIONS_VISIBLE
 * Observer: subscribes to SpinnerController state for auto-dismiss.
 */
import type { ChatOptionsSignal } from '../../shared/protocol';
import type { OptionsState, OptionsControllerOptions } from './types';
export declare class OptionsController {
    private state;
    private view;
    private onSelectCallback;
    private isSpinnerActive;
    private pendingSignal;
    constructor(options: OptionsControllerOptions);
    /**
     * Handle incoming chat:options signal from Extension Host.
     * Guards: ignore empty options, ignore during PROCESSING state (queue instead).
     */
    showOptions(signal: ChatOptionsSignal): void;
    /**
     * Handle option button click — send response and hide.
     */
    selectOption(text: string): void;
    /**
     * Handle custom text submit (Enter in textarea while options visible).
     * Called by InputAreaIntegration when user submits text.
     */
    submitCustom(): void;
    /**
     * Dismiss options (Escape, auto-dismiss from spinner, etc.)
     */
    dismiss(reason?: string): void;
    /**
     * Process pending options (called when spinner stops).
     * If options were queued during PROCESSING, show them now.
     */
    processPendingOptions(): void;
    /**
     * Keyboard event handler.
     * Returns true if the event was handled (should preventDefault + stopPropagation).
     */
    handleKeyDown(event: KeyboardEvent): boolean;
    /**
     * Check if options are currently visible.
     */
    isVisible(): boolean;
    /**
     * Get current state (for testing).
     */
    getState(): OptionsState;
    /**
     * Internal: hide options and reset state.
     */
    private hideOptions;
    dispose(): void;
}
//# sourceMappingURL=OptionsController.d.ts.map