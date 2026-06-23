/**
 * CaptureFilter — determines what content is worth auto-capturing.
 */

const DECISION_KEYWORDS = [
  'decided', 'chose', 'selected', 'approach', 'architecture',
  'design decision', 'trade-off', 'alternative',
];

const ERROR_KEYWORDS = [
  'error', 'failed', 'exception', 'bug', 'fix', 'root cause',
  'workaround', 'solution', 'resolved',
];

/** Check if text contains decision-related content. */
export function isDecisionContent(text: string): boolean {
  const lower = text.toLowerCase();
  return DECISION_KEYWORDS.some(kw => lower.includes(kw));
}

/** Check if text contains error pattern content. */
export function isErrorContent(text: string): boolean {
  const lower = text.toLowerCase();
  return ERROR_KEYWORDS.some(kw => lower.includes(kw));
}

/** Check if content is substantial enough to capture. */
export function isSubstantial(text: string, minLength = 50): boolean {
  return text.trim().length >= minLength;
}

/** Determine the best knowledge type for content. */
export function classifyContent(text: string): string {
  if (isDecisionContent(text)) return 'DECISION';
  if (isErrorContent(text)) return 'ERROR_PATTERN';
  if (text.includes('```')) return 'PROCEDURE';
  return 'CONTEXT';
}
