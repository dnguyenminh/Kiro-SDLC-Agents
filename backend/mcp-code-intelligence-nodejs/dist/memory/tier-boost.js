"use strict";
/**
 * TierBoost — tier-based score multiplier in search results.
 * SEMANTIC entries rank higher than WORKING.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tierBoostFactor = tierBoostFactor;
const FACTORS = {
    SEMANTIC: 1.5,
    PROCEDURAL: 1.3,
    EPISODIC: 1.1,
    WORKING: 1.0,
};
/** Get boost factor for a tier. Higher = ranked higher in results. */
function tierBoostFactor(tier) {
    return FACTORS[tier ?? ''] ?? 1.0;
}
//# sourceMappingURL=tier-boost.js.map