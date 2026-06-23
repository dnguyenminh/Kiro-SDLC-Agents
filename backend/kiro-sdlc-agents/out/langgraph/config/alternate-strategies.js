"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAlternateStrategy = getAlternateStrategy;
const ALTERNATE_STRATEGIES = {
    ba_brd: {
        nodeId: "ba_brd",
        description: "Simplified BRD with fewer sections, focus on core stories",
        promptModifier: "Use a simplified template. Focus only on the 3 most critical user stories. Skip optional sections. Prioritize completeness over breadth.",
        temperatureOverride: 0.3,
    },
    ba_fsd: {
        nodeId: "ba_fsd",
        description: "FSD with simplified flows, fewer alternative paths",
        promptModifier: "Simplify use case flows. Include only Main Flow and 1 Exception Flow per UC. Focus on happy path completeness.",
        temperatureOverride: 0.3,
    },
    sa_tdd: {
        nodeId: "sa_tdd",
        description: "TDD with higher-level design, less implementation detail",
        promptModifier: "Provide architecture overview and key interfaces only. Skip detailed method signatures. Focus on component interactions.",
        temperatureOverride: 0.4,
    },
    dev_code: {
        nodeId: "dev_code",
        description: "Implementation with simpler patterns, fewer abstractions",
        promptModifier: "Use straightforward implementation. Prefer inline logic over abstraction layers. Focus on correctness over elegance.",
        temperatureOverride: 0.2,
    },
    qa_plan: {
        nodeId: "qa_plan",
        description: "Test plan with fewer test levels, focus on critical paths",
        promptModifier: "Focus on Unit Tests and E2E-API tests only. Skip PBT and SIT. Cover only critical business paths.",
        temperatureOverride: 0.3,
    },
};
/** Get alternate strategy for a node. Returns null if not defined. */
function getAlternateStrategy(nodeId) {
    return ALTERNATE_STRATEGIES[nodeId] ?? null;
}
//# sourceMappingURL=alternate-strategies.js.map