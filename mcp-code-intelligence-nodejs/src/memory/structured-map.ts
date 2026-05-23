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
export function emptyStructuredMap(): StructuredMap {
  return {
    topic: '',
    entities_mentioned: [],
    decisions_made: [],
    action_items: [],
    context_refs: [],
    sentiment: 'neutral',
  };
}
