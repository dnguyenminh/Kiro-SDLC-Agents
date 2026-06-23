/**
 * Embedding Engine — Generate, store, and search embeddings via Ollama.
 * Optional component: gracefully skips if Ollama unavailable.
 */

import Database from 'better-sqlite3';
import { DatabaseManager } from '../db/database-manager.js';
import { OllamaClient } from './ollama-client.js';

export class EmbeddingEngine {
  private db: Database.Database;
  private client: OllamaClient;
  private enabled = false;

  constructor(dbManager: DatabaseManager, client: OllamaClient) {
    this.db = dbManager.getDb();
    this.client = client;
  }

  /** Initialize and check if embeddings are available. */
  async initialize(): Promise<void> {
    this.enabled = await this.client.isAvailable();
    if (this.enabled) {
      console.error('[embeddings] Ollama available, semantic search enabled');
    } else {
      console.error('[embeddings] Ollama unavailable, semantic search disabled');
    }
  }

  /** Generate and store embedding for a symbol. */
  async embedSymbol(symbolId: number, text: string, model: string): Promise<void> {
    if (!this.enabled) return;
    const vector = await this.client.generateEmbedding(text);
    if (!vector) return;
    this.storeEmbedding(symbolId, null, vector, model);
  }

  /** Semantic search using cosine similarity. */
  searchSimilar(queryVector: number[], limit: number = 10): SimilarResult[] {
    if (!this.enabled) return [];
    const rows = this.db.prepare(
      'SELECT id, symbol_id, file_id, vector FROM embeddings'
    ).all() as { id: number; symbol_id: number; file_id: number; vector: Buffer }[];

    const scored = rows
      .map(row => ({
        symbolId: row.symbol_id,
        fileId: row.file_id,
        score: cosineSimilarity(queryVector, deserializeVector(row.vector)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }

  /** Check if embedding engine is active. */
  isEnabled(): boolean {
    return this.enabled;
  }

  private storeEmbedding(
    symbolId: number | null, fileId: number | null,
    vector: number[], model: string
  ): void {
    const blob = serializeVector(vector);
    this.db.prepare(`
      INSERT INTO embeddings (symbol_id, file_id, vector, model)
      VALUES (?, ?, ?, ?)
    `).run(symbolId, fileId, blob, model);
  }
}

interface SimilarResult {
  symbolId: number;
  fileId: number;
  score: number;
}

function serializeVector(vector: number[]): Buffer {
  const buf = Buffer.alloc(vector.length * 4);
  for (let i = 0; i < vector.length; i++) {
    buf.writeFloatLE(vector[i], i * 4);
  }
  return buf;
}

function deserializeVector(buf: Buffer): number[] {
  const vector: number[] = [];
  for (let i = 0; i < buf.length; i += 4) {
    vector.push(buf.readFloatLE(i));
  }
  return vector;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
