/**
 * IngestPipeline — parse, chunk, and store knowledge entries.
 * Enhanced with quality gate validation before storage.
 * KSA-190: Added auto-linking after structured map extraction.
 */

import { KnowledgeRepository } from './knowledge-repo.js';
import { EmbeddingService } from './embedding/index.js';
import { parseMarkdown } from './document-parser.js';
import { SemanticChunker } from './chunking-strategy.js';
import { extractStructuredMap } from './structured-map-extractor.js';
import { EntityRepository } from './entity-repo.js';
import { classifyEntity } from './entity-classifier.js';
import type { QualityGate, QualityResult } from './v2/quality-gate.js';
import type { AutoLinker } from './auto-linker.js';
import type { AutoLinkResult } from './linking-strategies/types.js';
import type { ContradictionResolver, ResolutionResult } from './contradiction-resolver.js';

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
  contradiction?: ResolutionResult | null;
}

export class IngestPipeline {
  private readonly repo: KnowledgeRepository;
  private readonly embedding: EmbeddingService | null;
  private readonly chunker = new SemanticChunker(1024);
  private entityRepo: EntityRepository | null = null;
  private qualityGate: QualityGate | null = null;
  private autoLinker: AutoLinker | null = null;
  private contradictionResolver: ContradictionResolver | null = null;

  constructor(repo: KnowledgeRepository, embeddingService: EmbeddingService | null = null) {
    this.repo = repo;
    this.embedding = embeddingService;
  }

  /** Inject EntityRepository for structured map indexing. */
  setEntityRepo(repo: EntityRepository): void {
    this.entityRepo = repo;
  }

  /** Inject QualityGate for ingest validation. */
  setQualityGate(gate: QualityGate): void {
    this.qualityGate = gate;
  }

  /** Inject AutoLinker for automatic graph edge creation. KSA-190. */
  setAutoLinker(linker: AutoLinker): void {
    this.autoLinker = linker;
  }

  /** Inject ContradictionResolver for detecting conflicting info on ingest. */
  setContradictionResolver(resolver: ContradictionResolver): void {
    this.contradictionResolver = resolver;
  }

  /** Ingest a single knowledge entry with quality gate. Returns entry ID or rejection. */
  ingestEntry(content: string, summary: string, type: string, source?: string, tags = ''): number {
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
  ingestEntryWithQuality(
    content: string, summary: string, type: string, source?: string, tags = ''
  ): IngestEntryResult {
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
      const contradiction = this.tryDetectContradiction(id);
      return { id, quality, success: true, autoLink, contradiction };
    }
    const id = this.repo.insert({ content, summary, type, tier: 'WORKING', source, tags });
    this.tryEmbed(id, summary);
    this.tryExtractMap(id, content);
    const autoLink = this.tryAutoLink(id);
    const contradiction = this.tryDetectContradiction(id);
    return { id, quality: null, success: true, autoLink, contradiction };
  }

  /** Ingest a markdown document — splits by sections. */
  ingestMarkdown(text: string, source: string, type = 'CONTEXT'): IngestResult {
    const doc = parseMarkdown(text, source);
    let entriesCreated = 0;
    for (const section of doc.sections) {
      if (!section.content.trim()) continue;
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
  ingestText(text: string, source: string, type = 'CONTEXT'): IngestResult {
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
  private tryEmbed(entryId: number, text: string): void {
    if (!this.embedding) return;
    this.embedding.embedAndStore(entryId, text).catch((err) => {
      process.stderr.write(`[ingest] Embed failed for entry ${entryId}: ${err}\n`);
    });
  }

  /** Extract structured map and index entities. */
  private tryExtractMap(entryId: number, content: string): void {
    try {
      const map = extractStructuredMap(content);
      const mapJson = JSON.stringify(map);
      this.repo.updateStructuredMap(entryId, mapJson);
      if (this.entityRepo && map.entities_mentioned.length > 0) {
        const entities = map.entities_mentioned.map(name => ({
          name,
          type: classifyEntity(name),
        }));
        this.entityRepo.indexEntities(entryId, entities);
      }
    } catch { /* extraction must not break ingest */ }
  }

  /** Auto-link entry to related entries (fire-and-forget). KSA-190. */
  private tryAutoLink(entryId: number): AutoLinkResult | null {
    if (!this.autoLinker) return null;
    try {
      return this.autoLinker.link(entryId);
    } catch (err) {
      process.stderr.write(`[ingest] Auto-link failed for entry ${entryId}: ${err}\n`);
      return null;
    }
  }

  /** Set quality score on entry after ingest. */
  private trySetQualityScore(
    entryId: number, content: string, meta: { tags?: string; type?: string; source?: string }
  ): void {
    if (!this.qualityGate) return;
    try {
      const result = this.qualityGate.validate(content, meta);
      this.repo.updateQualityScore(entryId, result.score);
    } catch { /* quality scoring must not break ingest */ }
  }

  /** Detect contradictions with existing entries (fire-and-forget). */
  private tryDetectContradiction(entryId: number): ResolutionResult | null {
    if (!this.contradictionResolver) return null;
    try {
      return this.contradictionResolver.detectAndResolve(entryId);
    } catch (err) {
      process.stderr.write(`[ingest] Contradiction detection failed for entry ${entryId}: ${err}\n`);
      return null;
    }
  }
}

/** Error thrown when quality gate rejects content. */
export class QualityRejectionError extends Error {
  readonly quality: QualityResult;
  constructor(quality: QualityResult) {
    super(quality.message ?? 'Quality gate rejected content');
    this.name = 'QualityRejectionError';
    this.quality = quality;
  }
}

/** Assign tier based on knowledge type. */
function tierForType(type: string): string {
  switch (type) {
    case 'REQUIREMENT': case 'ARCHITECTURE': case 'PROCEDURE': case 'API_DESIGN':
      return 'SEMANTIC';
    case 'DECISION': case 'LESSON_LEARNED': case 'ERROR_PATTERN':
      return 'EPISODIC';
    default:
      return 'WORKING';
  }
}

function buildSummary(content: string, heading: string): string {
  const firstLine = content.split('\n').find(l => l.trim()) ?? '';
  const preview = firstLine.slice(0, 120);
  return heading ? `${heading}: ${preview}` : preview;
}
