/**
 * KSA-191: Salesforce relationship type definitions and type guards.
 * These relationship kinds are stored in the relationships table alongside
 * existing kinds (imports, calls, inherits, implements, decorates).
 */

/**
 * All SF-specific relationship kinds stored in the graph.
 */
export const SF_RELATIONSHIP_KINDS = [
  'trigger-on',
  'soql',
  'dml',
  'wire',
  'flow-action',
  'flow-object',
  'apex-import',
] as const;

export type SfRelationshipKind = typeof SF_RELATIONSHIP_KINDS[number];

/**
 * Type guard: checks if a relationship kind string is a Salesforce relationship.
 */
export function isSfRelationship(kind: string): kind is SfRelationshipKind {
  return (SF_RELATIONSHIP_KINDS as readonly string[]).includes(kind);
}

/**
 * Human-readable labels for each SF relationship kind.
 */
const SF_RELATIONSHIP_LABELS: Record<SfRelationshipKind, string> = {
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
export function getSfRelationshipLabel(kind: SfRelationshipKind): string {
  return SF_RELATIONSHIP_LABELS[kind] ?? kind;
}
