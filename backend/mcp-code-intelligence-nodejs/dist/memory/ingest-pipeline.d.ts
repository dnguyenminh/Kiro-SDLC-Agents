/**
 * IngestPipeline — parse, chunk, and store knowledge entries.
 * Enhanced with quality gate validation before storage.
 * KSA-190: Added auto-linking after structured map extraction.
 */
import { KnowledgeRepository } from './knowledge-repo.js';
import { EmbeddingService } from './embedding/index.js';
import { EntityRepository } from './entity-repo.js';
import type { QualityGate, QualityResult } from './v2/quality-gate.js';
import type { AutoLinker } from './auto-linker.js';
import type { AutoLinkResult } from './linking-strategies/types.js';
/** Result of ingesting a document. */
export interface IngestResult {
    entriesCreated: number;
    source: string;
}
/** Result of ingesting a single entry with quality info. */
export interface IngestEntryResult {
    id: number | null;
    quality: QualityResult | null;
    success: boolean;
    autoLink?: AutoLinkResult | null;
}
export declare class IngestPipeline {
    private readonly repo;
    private readonly embedding;
    private readonly chunker;
    private entityRepo;
    private qualityGate;
    private autoLinker;
    constructor(repo: KnowledgeRepository, embeddingService?: EmbeddingService | null);
    /** Inject EntityRepository for structured map indexing. */
    setEntityRepo(repo: EntityRepository): void;
    /** Inject QualityGate for ingest validation. */
    setQualityGate(gate: QualityGate): void;
    /** Inject AutoLinker for automatic graph edge creation. KSA-190. */
    setAutoLinker(linker: AutoLinker): void;
    /** Ingest a single knowledge entry with quality gate. Returns entry ID or rejection. */
    ingestEntry(content: string, summary: string, type: string, source?: string, tags?: string): number;
    /** Ingest with full quality result returned. */
    ingestEntryWithQuality(content: string, summary: string, type: string, source?: string, tags?: string): IngestEntryResult;
    /** Ingest a markdown document — splits by sections. */
    ingestMarkdown(text: string, source: string, type?: string): IngestResult;
    /** Ingest plain text. */
    ingestText(text: string, source: string, type?: string): IngestResult;
    /** Attempt to embed and store vector (fire-and-forget). */
    private tryEmbed;
    /** Extract structured map and index entities. */
    private tryExtractMap;
    /** Auto-link entry to related entries (fire-and-forget). KSA-190. */
    private tryAutoLink;
    /** Set quality score on entry after ingest. */
    private trySetQualityScore;
}
/** Error thrown when quality gate rejects content. */
export declare class QualityRejectionError extends Error {
    readonly quality: QualityResult;
    constructor(quality: QualityResult);
}
//# sourceMappingURL=ingest-pipeline.d.ts.map