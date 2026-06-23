"use strict";
/**
 * CaptureFilter — determines what content is worth auto-capturing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDecisionContent = isDecisionContent;
exports.isErrorContent = isErrorContent;
exports.isSubstantial = isSubstantial;
exports.classifyContent = classifyContent;
const DECISION_KEYWORDS = [
    'decided', 'chose', 'selected', 'approach', 'architecture',
    'design decision', 'trade-off', 'alternative',
];
const ERROR_KEYWORDS = [
    'error', 'failed', 'exception', 'bug', 'fix', 'root cause',
    'workaround', 'solution', 'resolved',
];
/** Check if text contains decision-related content. */
function isDecisionContent(text) {
    const lower = text.toLowerCase();
    return DECISION_KEYWORDS.some(kw => lower.includes(kw));
}
/** Check if text contains error pattern content. */
function isErrorContent(text) {
    const lower = text.toLowerCase();
    return ERROR_KEYWORDS.some(kw => lower.includes(kw));
}
/** Check if content is substantial enough to capture. */
function isSubstantial(text, minLength = 50) {
    return text.trim().length >= minLength;
}
/** Determine the best knowledge type for content. */
function classifyContent(text) {
    if (isDecisionContent(text))
        return 'DECISION';
    if (isErrorContent(text))
        return 'ERROR_PATTERN';
    if (text.includes('```'))
        return 'PROCEDURE';
    return 'CONTEXT';
}
//# sourceMappingURL=capture-filter.js.map