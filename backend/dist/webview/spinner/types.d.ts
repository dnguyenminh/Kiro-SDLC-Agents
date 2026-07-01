/**
 * Spinner types and constants — KSA-255
 */
/** Spinner processing states */
export type SpinnerState = 'READY' | 'PROCESSING';
/** Triggers that cause state transitions */
export type SpinnerTrigger = 'START' | 'STOP';
/** Reason for stopping */
export type StopReason = 'complete' | 'cancelled' | 'error' | 'timeout';
/** State transition definition */
export interface SpinnerTransition {
    from: SpinnerState;
    to: SpinnerState;
    trigger: SpinnerTrigger;
}
/** Configuration constants */
export declare const SPINNER_CONFIG: {
    readonly TIMEOUT_MS: 60000;
    readonly MAX_SHOW_DELAY_MS: 100;
    readonly MAX_STOP_DELAY_MS: 50;
    readonly ANIMATION_DURATION_MS: 1000;
    readonly SPINNER_SIZE_PX: 14;
    readonly TEXT_SIZE_PX: 11;
};
/** State transitions table */
export declare const SPINNER_TRANSITIONS: SpinnerTransition[];
