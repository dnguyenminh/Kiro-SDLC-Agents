/**
 * EmbeddingProvider — abstract interface for text-to-vector embedding.
 * Implementations: OnnxProvider (local), OllamaProvider (remote).
 */

/** Contract for text-to-vector embedding providers. */
export interface EmbeddingProvider {
  /** Model name identifier. */
  readonly modelName: string;

  /** Output vector dimensions. */
  readonly dimensions: number;

  /** Generate embedding vector for text. Returns null on failure. */
  embed(text: string): Promise<number[] | null>;

  /** Generate embeddings for multiple texts (batch). */
  embedBatch(texts: string[]): Promise<Array<number[] | null>>;

  /** Check if provider is ready. */
  isAvailable(): boolean;

  /** Release resources. */
  close(): void;
}
