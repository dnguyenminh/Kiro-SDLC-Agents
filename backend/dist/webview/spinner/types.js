/**
 * Spinner types and constants — KSA-255
 */
/** Configuration constants */
export const SPINNER_CONFIG = {
    TIMEOUT_MS: 60_000,
    MAX_SHOW_DELAY_MS: 100,
    MAX_STOP_DELAY_MS: 50,
    ANIMATION_DURATION_MS: 1000,
    SPINNER_SIZE_PX: 14,
    TEXT_SIZE_PX: 11,
};
/** State transitions table */
export const SPINNER_TRANSITIONS = [
    { from: 'READY', to: 'PROCESSING', trigger: 'START' },
    { from: 'PROCESSING', to: 'READY', trigger: 'STOP' },
];
//# sourceMappingURL=types.js.map