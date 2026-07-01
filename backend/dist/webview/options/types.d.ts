/**
 * Options types and constants — KSA-259
 * Interactive Options on Input Area when AI asks questions
 */
/** Options display states */
export type OptionsDisplayState = 'IDLE' | 'OPTIONS_VISIBLE';
/** State held by OptionsController */
export interface OptionsState {
    displayState: OptionsDisplayState;
    options: string[];
    question: string | null;
}
/** Initial state constant */
export declare const INITIAL_OPTIONS_STATE: OptionsState;
/** Configuration constants */
export declare const OPTIONS_CONFIG: {
    /** Maximum number of option buttons displayed */
    readonly MAX_OPTIONS: 5;
    /** Maximum character length per option text */
    readonly MAX_OPTION_LENGTH: 100;
    /** Maximum button width in px (CSS handles via max-width) */
    readonly MAX_BUTTON_WIDTH_PX: 200;
    /** Render target time in ms */
    readonly RENDER_TARGET_MS: 50;
    /** Hide target time in ms (1 frame) */
    readonly HIDE_TARGET_MS: 16;
};
/** Constructor options for OptionsController */
export interface OptionsControllerOptions {
    view: import('./OptionsView').OptionsView;
    onSelect: (text: string, source: 'option-click' | 'text-input') => void;
    isSpinnerActive: () => boolean;
}
