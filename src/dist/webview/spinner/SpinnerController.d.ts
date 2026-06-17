/**
 * SpinnerController — State machine for processing indicator
 * KSA-255
 *
 * Pattern: Mirrors ContextMenuController (KSA-252)
 * States: READY ↔ PROCESSING
 * Transitions are idempotent (BR-08)
 */
import type { SpinnerState, StopReason } from './types';
import { SpinnerView } from './SpinnerView';
export declare class SpinnerController {
    private state;
    private startedAt;
    private timeoutId;
    private view;
    private announcer;
    private onTimeout?;
    constructor(view: SpinnerView, onTimeout?: () => void);
    private setupAnnouncer;
    private announce;
    private transition;
    getState(): SpinnerState;
    isProcessing(): boolean;
    startProcessing(): void;
    stopProcessing(reason?: StopReason): void;
    dispose(): void;
}
//# sourceMappingURL=SpinnerController.d.ts.map