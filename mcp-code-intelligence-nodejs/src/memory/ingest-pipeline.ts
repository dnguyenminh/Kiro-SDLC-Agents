/**
 * IngestPipeline — parse, chunk, and store knowledge entries.
 */

import { KnowledgeRepository } from './knowledge-repo.js';
import { EmbeddingService } from './embedding/index.js';

/** Result of ingesting a document. */
export interface IngestResult {
  entriesCreated: number;
  source: string;
}

export class IngestPipeline {
  private readonly repo: KnowledgeRepository;
  private readonly embedding: EmbeddingService | null;

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
    const sections = this.parseMarkdownSections(text);
    let entriesCreated = 0;
    for (const section of sections) {
      if (!section.content.trim()) continue;
      const chunks = this.chunkText(section.content);
      for (const chunk of chunks) {
        const summary = this.buildSummary(chunk, section.heading);
        const id = this.repo.insert({ content: chunk, summary, type, tier: this.tierForType(type), source, tags: section.heading });
        this.tryEmbed(id, summary);
        entriesCreated++;
      }
    }
    return { entriesCreated, source };
  }

  /** Ingest plain text. */
  ingestText(text: string, source: string, type = 'CONTEXT'): IngestResult {
    const chunks = this.chunkText(text);
    let entriesCreated = 0;
    for (const chunk of chunks) {
      const summary = chunk.split('\n')[0]?.slice(0, 120) ?? source;
      const id = this.repo.insert({ content: chunk, summary, type, tier: this.tierForType(type), source, tags: '' });
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

  /** Assign tier based on knowledge type. */
  private tierForType(type: string): string {
    switch (type) {
      case 'REQUIREMENT': case 'ARCHITECTURE': case 'PROCEDURE': case 'API_DESIGN':
        return 'SEMANTIC';
      case 'DECISION': case 'LESSON_LEARNED': case 'ERROR_PATTERN':
        return 'EPISODIC';
      default:
        return 'WORKING';
    }
  }

  private parseMarkdownSections(text: string): Array<{ heading: string; content: string }> {
    const lines = text.split('\n');
    const sections: Array<{ heading: string; content: string }> = [];
    let currentHeading = '';
    let content: string[] = [];

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        if (content.length > 0 || currentHeading) {
          sections.push({ heading: currentHeading, content: content.join('\n').trim() });
          content = [];
        }
        currentHeading = match[2];
      } else {
        content.push(line);
      }
    }
    if (content.length > 0 || currentHeading) {
      sections.push({ heading: currentHeading, content: content.join('\n').trim() });
    }
    return sections;
  }

  private chunkText(text: string, maxSize = 1024): string[] {
    if (text.length <= maxSize) return [text];
    const paragraphs = text.split(/\n{2,}/).filter(p => p.trim());
    const chunks: string[] = [];
    let current = '';
    for (const para of paragraphs) {
      if (current.length + para.length > maxSize && current) {
        chunks.push(current.trim());
        current = '';
      }
      current += para + '\n\n';
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  private buildSummary(content: string, heading: string): string {
    const firstLine = content.split('\n').find(l => l.trim()) ?? '';
    const preview = firstLine.slice(0, 120);
    return heading ? `${heading}: ${preview}` : preview;
  }
}
