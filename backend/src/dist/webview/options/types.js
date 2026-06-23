"use strict";
/**
 * Options types and constants — KSA-259
 * Interactive Options on Input Area when AI asks questions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPTIONS_CONFIG = exports.INITIAL_OPTIONS_STATE = void 0;
/** Initial state constant */
exports.INITIAL_OPTIONS_STATE = {
    displayState: 'IDLE',
    options: [],
    question: null,
};
/** Configuration constants */
exports.OPTIONS_CONFIG = {
    /** Maximum number of option buttons displayed */
    MAX_OPTIONS: 5,
    /** Maximum character length per option text */
    MAX_OPTION_LENGTH: 100,
    /** Maximum button width in px (CSS handles via max-width) */
    MAX_BUTTON_WIDTH_PX: 200,
    /** Render target time in ms */
    RENDER_TARGET_MS: 50,
    /** Hide target time in ms (1 frame) */
    HIDE_TARGET_MS: 16,
};
//# sourceMappingURL=types.js.map