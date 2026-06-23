/**
 * KSA-191: Salesforce relationship type definitions and type guards.
 * These relationship kinds are stored in the relationships table alongside
 * existing kinds (imports, calls, inherits, implements, decorates).
 */
/**
 * All SF-specific relationship kinds stored in the graph.
 */
export declare const SF_RELATIONSHIP_KINDS: readonly ["trigger-on", "soql", "dml", "wire", "flow-action", "flow-object", "apex-import"];
export type SfRelationshipKind = typeof SF_RELATIONSHIP_KINDS[number];
/**
 * Type guard: checks if a relationship kind string is a Salesforce relationship.
 */
export declare function isSfRelationship(kind: string): kind is SfRelationshipKind;
/**
 * Get a human-readable label for a SF relationship kind.
 */
export declare function getSfRelationshipLabel(kind: SfRelationshipKind): string;
//# sourceMappingURL=sf-relationship-types.d.ts.map