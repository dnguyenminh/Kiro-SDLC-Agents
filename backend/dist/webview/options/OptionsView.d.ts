/**
 * OptionsView — DOM rendering of interactive option buttons
 * KSA-259
 *
 * Renders option buttons as a flex-wrap list above textarea.
 * Uses event delegation (1 click listener on container).
 * XSS-safe: uses textContent, never innerHTML for option text.
 */
export declare class OptionsView {
    private container;
    private announcer;
    private selectCallback;
    private parentContainer;
    private textarea;
    constructor(parentContainer: HTMLElement, textarea: HTMLElement);
    private createContainer;
    private setupAnnouncer;
    private announce;
    /**
     * Render option buttons into the container.
     * Uses DocumentFragment for batch DOM creation (performance).
     */
    render(options: string[], question?: string): void;
    /**
     * Hide and clear all option buttons.
     */
    hide(): void;
    /**
     * Register callback for option selection.
     */
    onSelect(cb: (text: string) => void): void;
    /**
     * Event delegation handler for button clicks.
     */
    private handleClick;
    /**
     * Get all rendered option buttons.
     */
    getButtons(): HTMLButtonElement[];
    /**
     * Check if options are currently visible.
     */
    isVisible(): boolean;
    /**
     * Get the container element (for testing).
     */
    getContainer(): HTMLElement;
    /**
     * Focus the first button (for keyboard navigation entry).
     */
    focusFirst(): void;
    /**
     * Focus the textarea (return focus after dismiss).
     */
    focusTextarea(): void;
    dispose(): void;
}
