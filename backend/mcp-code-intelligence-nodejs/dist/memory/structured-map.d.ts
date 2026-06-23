/**
 * StructuredMap interfaces — metadata enrichment for knowledge entries.
 * Each entry gets topic, entities, decisions, action items, context refs, sentiment.
 */
/** Structured metadata extracted from entry content. */
export interface StructuredMap {
    topic: string;
    entities_mentioned: string[];
    decisions_made: string[];
    action_items: string[];
    context_refs: string[];
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
}
/** Create an empty StructuredMap. */
export declare function emptyStructuredMap(): StructuredMap;
//# sourceMappingURL=structured-map.d.ts.map