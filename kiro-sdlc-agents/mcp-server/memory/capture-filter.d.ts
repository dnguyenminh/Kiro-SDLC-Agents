/**
 * CaptureFilter — determines what content is worth auto-capturing.
 */
/** Check if text contains decision-related content. */
export declare function isDecisionContent(text: string): boolean;
/** Check if text contains error pattern content. */
export declare function isErrorContent(text: string): boolean;
/** Check if content is substantial enough to capture. */
export declare function isSubstantial(text: string, minLength?: number): boolean;
/** Determine the best knowledge type for content. */
export declare function classifyContent(text: string): string;
//# sourceMappingURL=capture-filter.d.ts.map