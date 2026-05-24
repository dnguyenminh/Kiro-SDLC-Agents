"use strict";
/**
 * DecisionMemory — tracks architectural decisions and their rationale.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionMemory = void 0;
class DecisionMemory {
    repo;
    graphRepo;
    constructor(repo, graphRepo) {
        this.repo = repo;
        this.graphRepo = graphRepo;
    }
    /** Record a new decision. */
    recordDecision(decision) {
        const content = this.formatContent(decision);
        return this.repo.insert({
            content,
            summary: `Decision: ${decision.title}`,
            type: 'DECISION',
            tier: 'EPISODIC',
            source: decision.source ?? null,
            tags: decision.tags ?? '',
            confidence: 0.9,
        });
    }
    /** Link a decision to related entries. */
    linkDecision(decisionId, relatedId, relation = 'RELATES_TO') {
        this.graphRepo.addEdge({ sourceId: decisionId, targetId: relatedId, relation });
    }
    /** Find decisions. */
    findDecisions(limit = 20) {
        return this.repo.findByType('DECISION', limit);
    }
    formatContent(d) {
        const lines = [];
        lines.push(`## Context\n${d.context}`);
        lines.push(`\n## Decision\n${d.decision}`);
        lines.push(`\n## Rationale\n${d.rationale}`);
        if (d.alternatives && d.alternatives.length > 0) {
            lines.push('\n## Alternatives Considered');
            d.alternatives.forEach(a => lines.push(`- ${a}`));
        }
        if (d.consequences) {
            lines.push(`\n## Consequences\n${d.consequences}`);
        }
        return lines.join('\n');
    }
}
exports.DecisionMemory = DecisionMemory;
//# sourceMappingURL=decision.js.map