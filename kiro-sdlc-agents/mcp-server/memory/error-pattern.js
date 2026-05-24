"use strict";
/**
 * ErrorPatternMemory — tracks recurring errors and their solutions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorPatternMemory = void 0;
class ErrorPatternMemory {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    /** Record a new error pattern. */
    recordError(pattern) {
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
    findErrors(limit = 20) {
        return this.repo.findByType('ERROR_PATTERN', limit);
    }
    formatContent(p) {
        const lines = [];
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
exports.ErrorPatternMemory = ErrorPatternMemory;
//# sourceMappingURL=error-pattern.js.map