/**
 * Zero-context chunking strategies for document ingestion.
 */

/** A chunk of text with position metadata. */
export interface TextChunk {
  content: string;
  index: number;
  startOffset: number;
  endOffset: number;
  metadata: Record<string, string>;
}

/** Interface for chunking strategies. */
export interface ChunkingStrategy {
  chunk(text: string, metadata?: Record<string, string>): TextChunk[];
}

/** Fixed-size chunking with overlap. */
export class FixedSizeChunker implements ChunkingStrategy {
  private readonly chunkSize: number;
  private readonly overlap: number;

  constructor(chunkSize = 512, overlap = 64) {
    this.chunkSize = chunkSize;
    this.overlap = overlap;
  }

  chunk(text: string, metadata: Record<string, string> = {}): TextChunk[] {
    if (text.length <= this.chunkSize) {
      return [{ content: text, index: 0, startOffset: 0, endOffset: text.length, metadata }];
    }
    return this.splitFixed(text, metadata);
  }

  private splitFixed(text: string, metadata: Record<string, string>): TextChunk[] {
    const chunks: TextChunk[] = [];
    let start = 0;
    let index = 0;
    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      chunks.push({ content: text.slice(start, end), index, startOffset: start, endOffset: end, metadata });
      start += this.chunkSize - this.overlap;
      index++;
    }
    return chunks;
  }
}

/** Semantic chunking — splits on paragraph/section boundaries. */
export class SemanticChunker implements ChunkingStrategy {
  private readonly maxChunkSize: number;
  private readonly minChunkSize: number;

  constructor(maxChunkSize = 1024, minChunkSize = 100) {
    this.maxChunkSize = maxChunkSize;
    this.minChunkSize = minChunkSize;
  }

  chunk(text: string, metadata: Record<string, string> = {}): TextChunk[] {
    const paragraphs = splitParagraphs(text);
    return mergeParagraphs(paragraphs, this.maxChunkSize, metadata);
  }
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).filter(p => p.trim());
}

function mergeParagraphs(
  paragraphs: string[], maxSize: number, metadata: Record<string, string>
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let current = '';
  let offset = 0;
  let index = 0;

  for (const para of paragraphs) {
    if (current.length + para.length > maxSize && current) {
      chunks.push({ content: current.trim(), index, startOffset: offset, endOffset: offset + current.length, metadata });
      offset += current.length;
      current = '';
      index++;
    }
    current += para + '\n';
  }
  if (current.trim()) {
    chunks.push({ content: current.trim(), index, startOffset: offset, endOffset: offset + current.length, metadata });
  }
  return chunks;
}
