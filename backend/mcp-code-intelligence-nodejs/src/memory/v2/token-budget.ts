/**
 * TokenBudget — caps search results to a configurable token limit.
 * Prioritizes higher-ranked results. Truncates individual entries
 * if a single result exceeds remaining budget.
 */

import { SearchResult } from '../models.js';
import { countTokens, truncateToFit } from '../token-counter.js';

export interface BudgetResult {
  results: SearchResult[];
  tokensUsed: number;
  truncated: boolean;
  totalMatches: number;
}

export class TokenBudget {
  /** Apply token budget to search results. Results must be pre-sorted by score. */
  apply(results: SearchResult[], maxTokens: number): BudgetResult {
    const totalMatches = results.length;
    const limited: SearchResult[] = [];
    let tokensUsed = 0;
    let truncated = false;

    for (const result of results) {
      const entryTokens = countTokens(result.entry.content);

      if (tokensUsed + entryTokens <= maxTokens) {
        limited.push(result);
        tokensUsed += entryTokens;
      } else {
        const remaining = maxTokens - tokensUsed;
        if (remaining >= 50) {
          // Truncate this entry to fit remaining budget
          const truncatedContent = truncateToFit(result.entry.content, remaining);
          limited.push({
            ...result,
            entry: { ...result.entry, content: truncatedContent },
          });
          tokensUsed += countTokens(truncatedContent);
        }
        truncated = true;
        break;
      }
    }

    return { results: limited, tokensUsed, truncated, totalMatches };
  }
}
