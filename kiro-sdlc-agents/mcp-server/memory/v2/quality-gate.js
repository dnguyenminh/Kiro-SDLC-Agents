"use strict";
/**
 * QualityGate — validates content before ingest to prevent KB pollution.
 * Checks: minimum length, duplicate detection, quality scoring.
 * Rejects entries with score < 30, warns for score 30-50.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityGate = void 0;
class QualityGate {
    db;
    minLength;
    rejectThreshold;
    warnThreshold;
    duplicateThreshold;
    constructor(db, options) {
        this.db = db;
        this.minLength = options?.minLength ?? 50;
        this.rejectThreshold = options?.rejectThreshold ?? 30;
        this.warnThreshold = options?.warnThreshold ?? 50;
        this.duplicateThreshold = options?.duplicateThreshold ?? 0.95;
    }
    /** Validate content before ingest. Returns quality decision. */
    validate(content, meta) {
        if (!content || content.trim().length < this.minLength) {
            return {
                score: 0,
                decision: 'reject',
                message: `Content too short (min ${this.minLength} chars). Got ${content?.trim().length ?? 0}.`,
                duplicate_detected: false,
                duplicate_entry_id: null,
            };
        }
        const duplicate = this.checkDuplicate(content);
        if (duplicate.similarity >= this.duplicateThreshold) {
            return {
                score: 10,
                decision: 'reject',
                message: `Duplicate detected (similarity: ${(duplicate.similarity * 100).toFixed(1)}%). Existing entry ID: ${duplicate.entryId}`,
                duplicate_detected: true,
                duplicate_entry_id: duplicate.entryId,
            };
        }
        const score = this.calculateScore(content, meta);
        const decision = this.decideFromScore(score);
        const message = decision === 'warn'
            ? `Low quality score (${score}/100). Consider adding tags, source, or more detail.`
            : null;
        return { score, decision, message, duplicate_detected: false, duplicate_entry_id: null };
    }
    /** Calculate quality score (0-100) based on content and metadata. */
    calculateScore(content, meta) {
        let score = 0;
        // Length factor: 0-40 points (caps at 500 chars)
        const trimmed = content.trim();
        score += Math.min(40, Math.floor((trimmed.length / 500) * 40));
        // Has tags: +20
        if (meta.tags && meta.tags.trim().length > 0)
            score += 20;
        // Has type specified: +10
        if (meta.type && meta.type.trim().length > 0)
            score += 10;
        // Has source reference: +10
        if (meta.source && meta.source.trim().length > 0)
            score += 10;
        // Has structure (headings, lists, code blocks): +10
        if (hasStructure(trimmed))
            score += 10;
        // Has actionable content (decisions, todos): +10
        if (hasActionableContent(trimmed))
            score += 10;
        return Math.min(100, score);
    }
    /** Check for near-duplicate content using trigram similarity. */
    checkDuplicate(content) {
        const trigrams = buildTrigrams(content.trim().toLowerCase().slice(0, 200));
        if (trigrams.size === 0)
            return { similarity: 0, entryId: null };
        const candidates = this.db.prepare(`SELECT id, content FROM knowledge_entries
       WHERE archived = 0
       ORDER BY created_at DESC LIMIT 50`).all();
        let maxSimilarity = 0;
        let matchId = null;
        for (const candidate of candidates) {
            const candidateTrigrams = buildTrigrams(candidate.content.trim().toLowerCase().slice(0, 200));
            const sim = jaccardSimilarity(trigrams, candidateTrigrams);
            if (sim > maxSimilarity) {
                maxSimilarity = sim;
                matchId = candidate.id;
            }
        }
        return { similarity: maxSimilarity, entryId: matchId };
    }
    decideFromScore(score) {
        if (score < this.rejectThreshold)
            return 'reject';
        if (score < this.warnThreshold)
            return 'warn';
        return 'accept';
    }
}
exports.QualityGate = QualityGate;
/** Check if content has structural elements. */
function hasStructure(text) {
    return /^#{1,6}\s/m.test(text) || /^[-*]\s/m.test(text) || /```/.test(text);
}
/** Check if content has actionable items. */
function hasActionableContent(text) {
    return /\b(TODO|Action:|Decision:|Next step:|Decided:)\b/i.test(text)
        || /\[[ x]\]/i.test(text);
}
/** Build character trigrams from text. */
function buildTrigrams(text) {
    const set = new Set();
    for (let i = 0; i <= text.length - 3; i++) {
        set.add(text.slice(i, i + 3));
    }
    return set;
}
/** Jaccard similarity between two trigram sets. */
function jaccardSimilarity(a, b) {
    if (a.size === 0 && b.size === 0)
        return 1;
    let intersection = 0;
    for (const t of a) {
        if (b.has(t))
            intersection++;
    }
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
}
//# sourceMappingURL=quality-gate.js.map