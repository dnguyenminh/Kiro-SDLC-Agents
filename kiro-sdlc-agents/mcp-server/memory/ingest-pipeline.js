"use strict";
/**
 * IngestPipeline — parse, chunk, and store knowledge entries.
 * Enhanced with quality gate validation before storage.
 * KSA-190: Added auto-linking after structured map extraction.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityRejectionError = exports.IngestPipeline = void 0;
const document_parser_js_1 = require("./document-parser.js");
const chunking_strategy_js_1 = require("./chunking-strategy.js");
const structured_map_extractor_js_1 = require("./structured-map-extractor.js");
const entity_classifier_js_1 = require("./entity-classifier.js");
class IngestPipeline {
    repo;
    embedding;
    chunker = new chunking_strategy_js_1.SemanticChunker(1024);
    entityRepo = null;
    qualityGate = null;
    autoLinker = null;
    constructor(repo, embeddingService = null) {
        this.repo = repo;
        this.embedding = embeddingService;
    }
    /** Inject EntityRepository for structured map indexing. */
    setEntityRepo(repo) {
        this.entityRepo = repo;
    }
    /** Inject QualityGate for ingest validation. */
    setQualityGate(gate) {
        this.qualityGate = gate;
    }
    /** Inject AutoLinker for automatic graph edge creation. KSA-190. */
    setAutoLinker(linker) {
        this.autoLinker = linker;
    }
    /** Ingest a single knowledge entry with quality gate. Returns entry ID or rejection. */
    ingestEntry(content, summary, type, source, tags = '') {
        // Quality gate check (if enabled)
        if (this.qualityGate) {
            const quality = this.qualityGate.validate(content, { tags, type, source });
            if (quality.decision === 'reject') {
                throw new QualityRejectionError(quality);
            }
        }
        const id = this.repo.insert({ content, summary, type, tier: 'WORKING', source, tags });
        this.tryEmbed(id, summary);
        this.tryExtractMap(id, content);
        this.tryAutoLink(id);
        this.trySetQualityScore(id, content, { tags, type, source });
        return id;
    }
    /** Ingest with full quality result returned. */
    ingestEntryWithQuality(content, summary, type, source, tags = '') {
        if (this.qualityGate) {
            const quality = this.qualityGate.validate(content, { tags, type, source });
            if (quality.decision === 'reject') {
                return { id: null, quality, success: false };
            }
            const id = this.repo.insert({ content, summary, type, tier: 'WORKING', source, tags });
            this.tryEmbed(id, summary);
            this.tryExtractMap(id, content);
            const autoLink = this.tryAutoLink(id);
            this.trySetQualityScore(id, content, { tags, type, source });
            return { id, quality, success: true, autoLink };
        }
        const id = this.repo.insert({ content, summary, type, tier: 'WORKING', source, tags });
        this.tryEmbed(id, summary);
        this.tryExtractMap(id, content);
        const autoLink = this.tryAutoLink(id);
        return { id, quality: null, success: true, autoLink };
    }
    /** Ingest a markdown document — splits by sections. */
    ingestMarkdown(text, source, type = 'CONTEXT') {
        const doc = (0, document_parser_js_1.parseMarkdown)(text, source);
        let entriesCreated = 0;
        for (const section of doc.sections) {
            if (!section.content.trim())
                continue;
            const chunks = this.chunker.chunk(section.content);
            for (const chunk of chunks) {
                const summary = buildSummary(chunk.content, section.heading);
                const id = this.repo.insert({ content: chunk.content, summary, type, tier: tierForType(type), source, tags: section.heading });
                this.tryEmbed(id, summary);
                this.tryExtractMap(id, chunk.content);
                this.tryAutoLink(id);
                entriesCreated++;
            }
        }
        return { entriesCreated, source };
    }
    /** Ingest plain text. */
    ingestText(text, source, type = 'CONTEXT') {
        const chunks = this.chunker.chunk(text);
        let entriesCreated = 0;
        for (const chunk of chunks) {
            const summary = chunk.content.split('\n')[0]?.slice(0, 120) ?? source;
            const id = this.repo.insert({ content: chunk.content, summary, type, tier: tierForType(type), source, tags: '' });
            this.tryEmbed(id, summary);
            this.tryExtractMap(id, chunk.content);
            this.tryAutoLink(id);
            entriesCreated++;
        }
        return { entriesCreated, source };
    }
    /** Attempt to embed and store vector (fire-and-forget). */
    tryEmbed(entryId, text) {
        if (!this.embedding)
            return;
        this.embedding.embedAndStore(entryId, text).catch((err) => {
            process.stderr.write(`[ingest] Embed failed for entry ${entryId}: ${err}\n`);
        });
    }
    /** Extract structured map and index entities. */
    tryExtractMap(entryId, content) {
        try {
            const map = (0, structured_map_extractor_js_1.extractStructuredMap)(content);
            const mapJson = JSON.stringify(map);
            this.repo.updateStructuredMap(entryId, mapJson);
            if (this.entityRepo && map.entities_mentioned.length > 0) {
                const entities = map.entities_mentioned.map(name => ({
                    name,
                    type: (0, entity_classifier_js_1.classifyEntity)(name),
                }));
                this.entityRepo.indexEntities(entryId, entities);
            }
        }
        catch { /* extraction must not break ingest */ }
    }
    /** Auto-link entry to related entries (fire-and-forget). KSA-190. */
    tryAutoLink(entryId) {
        if (!this.autoLinker)
            return null;
        try {
            return this.autoLinker.link(entryId);
        }
        catch (err) {
            process.stderr.write(`[ingest] Auto-link failed for entry ${entryId}: ${err}\n`);
            return null;
        }
    }
    /** Set quality score on entry after ingest. */
    trySetQualityScore(entryId, content, meta) {
        if (!this.qualityGate)
            return;
        try {
            const result = this.qualityGate.validate(content, meta);
            this.repo.updateQualityScore(entryId, result.score);
        }
        catch { /* quality scoring must not break ingest */ }
    }
}
exports.IngestPipeline = IngestPipeline;
/** Error thrown when quality gate rejects content. */
class QualityRejectionError extends Error {
    quality;
    constructor(quality) {
        super(quality.message ?? 'Quality gate rejected content');
        this.name = 'QualityRejectionError';
        this.quality = quality;
    }
}
exports.QualityRejectionError = QualityRejectionError;
/** Assign tier based on knowledge type. */
function tierForType(type) {
    switch (type) {
        case 'REQUIREMENT':
        case 'ARCHITECTURE':
        case 'PROCEDURE':
        case 'API_DESIGN':
            return 'SEMANTIC';
        case 'DECISION':
        case 'LESSON_LEARNED':
        case 'ERROR_PATTERN':
            return 'EPISODIC';
        default:
            return 'WORKING';
    }
}
function buildSummary(content, heading) {
    const firstLine = content.split('\n').find(l => l.trim()) ?? '';
    const preview = firstLine.slice(0, 120);
    return heading ? `${heading}: ${preview}` : preview;
}
//# sourceMappingURL=ingest-pipeline.js.map