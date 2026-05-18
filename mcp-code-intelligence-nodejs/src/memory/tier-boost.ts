/**
 * TierBoost — tier-based score multiplier in search results.
 * SEMANTIC entries rank higher than WORKING.
 */

const FACTORS: Record<string, number> = {
  SEMANTIC: 1.5,
  PROCEDURAL: 1.3,
  EPISODIC: 1.1,
  WORKING: 1.0,
};

/** Get boost factor for a tier. Higher = ranked higher in results. */
export function tierBoostFactor(tier?: string | null): number {
  return FACTORS[tier ?? ''] ?? 1.0;
}
