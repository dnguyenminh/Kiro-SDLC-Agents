/**
 * IngestPipeline — parse, chunk, and store knowledge entries.
 */

import { KnowledgeRepository } from './knowledge-repo.js';
import { EmbeddingService } from './embedding/index.js';
import { parseMarkdown } from './document-parser.js';
import { SemanticChunker } from './chunking-strategy.js';

/** Result of ingesting a document. */
export interface IngestResult {
  entriesCreated: number;
  source: string;
}

export class IngestPipeline {
  private readonly repo: KnowledgeRepository;
  private readonly embedding: EmbeddingService | null;
  private readonly chunker = new SemanticChunker(1024);

  constructor(repo: KnowledgeRepository, embeddingService: EmbeddingService | null = null) {
    this.repo = repo;
    this.embedding = embeddingService;
  }

  /** Ingest a single knowledge entry directly. Returns entry ID. */
  ingestEntry(content: string, summary: string, type: string, source?: string, tags = ''): number {
    const id = this.repo.insert({ content, summary, type, tier: 'WORKING', source, tags });
    this.tryEmbed(id, summary);
    return id;
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
