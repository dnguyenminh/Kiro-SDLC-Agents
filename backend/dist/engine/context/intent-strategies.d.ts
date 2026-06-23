/**
 * KSA-158: Intent Strategies — maps intent to prioritized section list.
 */
export interface SectionDef {
    name: string;
    priority: number;
    format: 'full' | 'summary' | 'signatures';
}
export interface IntentStrategy {
    intent: string;
    sections: SectionDef[];
}
/** Get the intent strategy (section priorities) for a given intent. Falls back to 'explain'. */
export declare function getStrategy(intent: string): IntentStrategy;
/** Get all supported intent names. */
export declare function getSupportedIntents(): string[];
