/**
 * ErrorPatternMemory — tracks recurring errors and their solutions.
 */

export interface ErrorPattern {
  errorMessage: string;
  context: string;
  rootCause: string;
  solution: string;
  prevention?: string;
  source?: string;
  tags?: string;
}

export class ErrorPatternMemory {
  private repo: any;

  constructor(repo: any) {
    this.repo = repo;
  }

  /** Record a new error pattern. */
  recordError(pattern: ErrorPattern): number {
    const content = this.formatContent(pattern);
    return this.repo.insert({
      content,
      summary: `Error: ${pattern.errorMessage.slice(0, 80)}`,
      type: 'ERROR_PATTERN',
      tier: 'EPISODIC',
      source: pattern.source ?? null,
      tags: pattern.tags ?? '',
      confidence: 0.8,
    });
  }

  /** Find error patterns. */
  findErrors(limit = 20): any[] {
    return this.repo.findByType('ERROR_PATTERN', limit);
  }

  private formatContent(p: ErrorPattern): string {
    const lines: string[] = [];
    lines.push(`## Error\n${p.errorMessage}`);
    lines.push(`\n## Context\n${p.context}`);
    lines.push(`\n## Root Cause\n${p.rootCause}`);
    lines.push(`\n## Solution\n${p.solution}`);
    if (p.prevention) {
      lines.push(`\n## Prevention\n${p.prevention}`);
    }
    return lines.join('\n');
  }
}
