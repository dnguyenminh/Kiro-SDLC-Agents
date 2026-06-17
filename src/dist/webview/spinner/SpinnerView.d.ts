/**
 * SpinnerView — DOM rendering for spinner + working text
 * KSA-255
 */
export declare class SpinnerView {
    private container;
    private spinnerEl;
    private textarea;
    private originalPlaceholder;
    constructor(container: HTMLElement, textarea: HTMLElement);
    show(): void;
    hide(): void;
    isVisible(): boolean;
    getElement(): HTMLElement | null;
}
//# sourceMappingURL=SpinnerView.d.ts.map