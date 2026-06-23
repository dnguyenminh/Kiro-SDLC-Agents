"use strict";
/**
 * KSA-191: Salesforce relationship type definitions and type guards.
 * These relationship kinds are stored in the relationships table alongside
 * existing kinds (imports, calls, inherits, implements, decorates).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SF_RELATIONSHIP_KINDS = void 0;
exports.isSfRelationship = isSfRelationship;
exports.getSfRelationshipLabel = getSfRelationshipLabel;
/**
 * All SF-specific relationship kinds stored in the graph.
 */
exports.SF_RELATIONSHIP_KINDS = [
    'trigger-on',
    'soql',
    'dml',
    'wire',
    'flow-action',
    'flow-object',
    'apex-import',
];
/**
 * Type guard: checks if a relationship kind string is a Salesforce relationship.
 */
function isSfRelationship(kind) {
    return exports.SF_RELATIONSHIP_KINDS.includes(kind);
}
/**
 * Human-readable labels for each SF relationship kind.
 */
const SF_RELATIONSHIP_LABELS = {
    'trigger-on': 'Trigger fires on SObject',
    'soql': 'SOQL query on SObject',
    'dml': 'DML operation on SObject',
    'wire': 'LWC @wire adapter call',
    'flow-action': 'Flow invokes Apex class',
    'flow-object': 'Flow references SObject',
    'apex-import': 'LWC imports Apex method',
};
/**
 * Get a human-readable label for a SF relationship kind.
 */
function getSfRelationshipLabel(kind) {
    return SF_RELATIONSHIP_LABELS[kind] ?? kind;
}
//# sourceMappingURL=sf-relationship-types.js.map