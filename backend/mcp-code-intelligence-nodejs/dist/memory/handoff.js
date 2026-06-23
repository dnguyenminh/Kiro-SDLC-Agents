"use strict";
/**
 * AgentHandoffMemory — preserves context between agent sessions.
 * Structured handoff records with decisions, questions, artifacts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentHandoffMemory = void 0;
class AgentHandoffMemory {
    repo;
    searchRepo;
    constructor(repo, searchRepo) {
        this.repo = repo;
        this.searchRepo = searchRepo;
    }
    /** Record a handoff between agents. */
    recordHandoff(ctx) {
        const content = this.formatHandoff(ctx);
        return this.repo.insert({
            content,
            summary: `Handoff: ${ctx.fromAgent} → ${ctx.toAgent}: ${ctx.summary.slice(0, 60)}`,
            type: 'CONTEXT',
            tier: 'WORKING',
            source: ctx.ticketKey ?? null,
            tags: `handoff,${ctx.fromAgent},${ctx.toAgent}`,
        });
    }
    /** Get recent handoffs for an agent. */
    getHandoffsForAgent(agentName, limit = 5) {
        const results = this.searchRepo.searchByTags(['handoff', agentName], limit);
        return results.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    }
    /** Get latest handoff context for a ticket. */
    getLatestForTicket(ticketKey) {
        const results = this.searchRepo.search(`${ticketKey} handoff`, 1);
        return results[0]?.entry ?? null;
    }
    formatHandoff(ctx) {
        const lines = [];
        lines.push(`## Agent Handoff: ${ctx.fromAgent} → ${ctx.toAgent}`);
        lines.push(`\n### Summary\n${ctx.summary}`);
        if (ctx.keyDecisions.length > 0) {
            lines.push('\n### Key Decisions');
            ctx.keyDecisions.forEach(d => lines.push(`- ${d}`));
        }
        if (ctx.openQuestions.length > 0) {
            lines.push('\n### Open Questions');
            ctx.openQuestions.forEach(q => lines.push(`- ${q}`));
        }
        if (ctx.artifacts.length > 0) {
            lines.push('\n### Artifacts');
            ctx.artifacts.forEach(a => lines.push(`- ${a}`));
        }
        return lines.join('\n');
    }
}
exports.AgentHandoffMemory = AgentHandoffMemory;
//# sourceMappingURL=handoff.js.map