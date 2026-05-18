/**
 * RoleFilter — maps agent roles to relevant knowledge entry types.
 */

const ROLE_TYPES: Record<string, Set<string>> = {
  DEV: new Set(['CODE_ENTITY', 'ARCHITECTURE', 'API_DESIGN', 'DECISION']),
  BA: new Set(['REQUIREMENT', 'CONTEXT', 'DECISION', 'LESSON_LEARNED']),
  QA: new Set(['PROCEDURE', 'REQUIREMENT', 'ERROR_PATTERN', 'LESSON_LEARNED']),
  SA: new Set(['ARCHITECTURE', 'API_DESIGN', 'CODE_ENTITY', 'DECISION']),
  DEVOPS: new Set(['PROCEDURE', 'ARCHITECTURE', 'CONTEXT']),
};

/** Get allowed types for a role. Returns null if no filter (all types). */
export function typesForRole(role?: string | null): Set<string> | null {
  if (!role || !role.trim()) return null;
  return ROLE_TYPES[role.toUpperCase()] ?? null;
}
