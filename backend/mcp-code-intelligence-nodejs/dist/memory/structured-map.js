"use strict";
/**
 * StructuredMap interfaces — metadata enrichment for knowledge entries.
 * Each entry gets topic, entities, decisions, action items, context refs, sentiment.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyStructuredMap = emptyStructuredMap;
/** Create an empty StructuredMap. */
function emptyStructuredMap() {
    return {
        topic: '',
        entities_mentioned: [],
        decisions_made: [],
        action_items: [],
        context_refs: [],
        sentiment: 'neutral',
    };
}
//# sourceMappingURL=structured-map.js.map