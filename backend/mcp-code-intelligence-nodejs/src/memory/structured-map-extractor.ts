/**
 * StructuredMapExtractor — rule-based extraction of metadata from content.
 * No LLM dependency: uses regex patterns and keyword scoring.
 */

import { StructuredMap, emptyStructuredMap } from './structured-map.js';

/** Extract structured map from text content. */
export function extractStructuredMap(content: string): StructuredMap {
  if (!content || content.trim().length === 0) return emptyStructuredMap();
  return {
    topic: extractTopic(content),
    entities_mentioned: extractEntities(content),
    decisions_made: extractDecisions(content),
    action_items: extractActionItems(content),
    context_refs: extractContextRefs(content),
    sentiment: analyzeSentiment(content),
  };
}

/** Extract primary topic from first heading or first sentence. */
function extractTopic(content: string): string {
  const headingMatch = content.match(/^#+\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim().slice(0, 120);
  const firstLine = content.split('\n').find(l => l.trim().length > 0);
  return (firstLine ?? '').trim().slice(0, 120);
}

/** Extract entities: ticket IDs, file paths, @mentions, PascalCase names. */
function extractEntities(content: string): string[] {
  const entities = new Set<string>();
  const patterns: RegExp[] = [
    /[A-Z][A-Z0-9]+-\d+/g,                    // Ticket IDs (JIRA-123)
    /@[\w-]+/g,                                 // @mentions
    /(?:^|\s)((?:[A-Z][a-z0-9]+){2,})/gm,     // PascalCase class names
  ];
  for (const pat of patterns) {
    for (const match of content.matchAll(pat)) {
      entities.add(match[0].trim());
    }
  }
  return [...entities].slice(0, 20);
}

/** Extract decisions from content. */
function extractDecisions(content: string): string[] {
  const decisions: string[] = [];
  const lines = content.split('\n');
  const prefixes = ['decision:', 'decided:', 'we will', 'chosen approach', 'agreed:'];
  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    if (prefixes.some(p => lower.startsWith(p))) {
      decisions.push(line.trim().slice(0, 200));
    }
  }
  return decisions.slice(0, 10);
}

/** Extract action items (TODOs, next steps). */
function extractActionItems(content: string): string[] {
  const items: string[] = [];
  const lines = content.split('\n');
  const patterns = [/TODO/i, /action:/i, /next step:/i, /\[ \]/];
  for (const line of lines) {
    if (patterns.some(p => p.test(line))) {
      items.push(line.trim().slice(0, 200));
    }
  }
  return items.slice(0, 10);
}

/** Extract context references: URLs, file paths, ticket IDs. */
function extractContextRefs(content: string): string[] {
  const refs = new Set<string>();
  const patterns: RegExp[] = [
    /https?:\/\/[^\s)]+/g,                     // URLs
    /[A-Z][A-Z0-9]+-\d+/g,                    // Ticket IDs
    /(?:[\w-]+\/)+[\w-]+\.\w+/g,              // File paths (src/foo/bar.ts)
  ];
  for (const pat of patterns) {
    for (const match of content.matchAll(pat)) {
      refs.add(match[0]);
    }
  }
  return [...refs].slice(0, 20);
}

/** Simple keyword-based sentiment analysis. */
function analyzeSentiment(content: string): StructuredMap['sentiment'] {
  const lower = content.toLowerCase();
  const posWords = ['success', 'resolved', 'fixed', 'improved', 'great', 'works', 'done', 'complete'];
  const negWords = ['error', 'fail', 'bug', 'broken', 'issue', 'problem', 'crash', 'blocked'];
  let posScore = 0;
  let negScore = 0;
  for (const w of posWords) if (lower.includes(w)) posScore++;
  for (const w of negWords) if (lower.includes(w)) negScore++;
  if (posScore > 0 && negScore > 0) return 'mixed';
  if (posScore > negScore) return 'positive';
  if (negScore > posScore) return 'negative';
  return 'neutral';
}
