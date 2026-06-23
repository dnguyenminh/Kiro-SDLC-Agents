/**
 * AgentHandoffMemory — preserves context between agent sessions.
 * Structured handoff records with decisions, questions, artifacts.
 */

export interface HandoffContext {
  fromAgent: string;
  toAgent: string;
  summary: string;
  keyDecisions: string[];
  openQuestions: string[];
  artifacts: string[];
  ticketKey?: string;
}

export class AgentHandoffMemory {
  private repo: any;
  private searchRepo: any;

  constructor(repo: any, searchRepo: any) {
    this.repo = repo;
    this.searchRepo = searchRepo;
  }

  /** Record a handoff between agents. */
  recordHandoff(ctx: HandoffContext): number {
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
  getHandoffsForAgent(agentName: string, limit = 5): any[] {
    const results = this.searchRepo.searchByTags(['handoff', agentName], limit);
    return results.sort((a: any, b: any) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    );
  }

  /** Get latest handoff context for a ticket. */
  getLatestForTicket(ticketKey: string): any | null {
    const results = this.searchRepo.search(`${ticketKey} handoff`, 1);
    return results[0]?.entry ?? null;
  }

  private formatHandoff(ctx: HandoffContext): string {
    const lines: string[] = [];
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
