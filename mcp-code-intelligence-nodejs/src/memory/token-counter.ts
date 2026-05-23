/**
 * Token counting utility — approximate token count for budget enforcement.
 * Uses chars/4 heuristic (good enough for ~2000 token budgets).
 */

/** Approximate token count using chars/4 heuristic. */
export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Check if text fits within a token budget. */
export function fitsInBudget(text: string, budget: number): boolean {
  return countTokens(text) <= budget;
}

/** Truncate text to fit within token budget, preserving whole words. */
export function truncateToFit(text: string, budget: number): string {
  if (fitsInBudget(text, budget)) return text;
  const charLimit = budget * 4;
  const truncated = text.slice(0, charLimit);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
}
