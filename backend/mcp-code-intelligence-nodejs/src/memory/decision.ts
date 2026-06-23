/**
 * DecisionMemory — tracks architectural decisions and their rationale.
 */

export interface Decision {
  title: string;
  context: string;
  decision: string;
  rationale: string;
  alternatives?: string[];
  consequences?: string;
  source?: string;
  tags?: string;
}

export class DecisionMemory {
  private repo: any;
  private graphRepo: any;

  constructor(repo: any, graphRepo: any) {
    this.repo = repo;
    this.graphRepo = graphRepo;
  }

  /** Record a new decision. */
  recordDecision(decision: Decision): number {
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
  linkDecision(decisionId: number, relatedId: number, relation = 'RELATES_TO'): void {
    this.graphRepo.addEdge({ sourceId: decisionId, targetId: relatedId, relation });
  }

  /** Find decisions. */
  findDecisions(limit = 20): any[] {
    return this.repo.findByType('DECISION', limit);
  }

  private formatContent(d: Decision): string {
    const lines: string[] = [];
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
