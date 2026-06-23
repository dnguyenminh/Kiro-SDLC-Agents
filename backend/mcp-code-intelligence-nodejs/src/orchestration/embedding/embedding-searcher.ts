/**
 * EmbeddingSearcher — adapter connecting find_tools to ONNX embedding search.
 */

import * as path from 'path';
import * as fs from 'fs';
import { ToolEmbeddingIndex } from './tool-index.js';
import { ModelManager } from '../models/model-manager.js';
import { UnifiedRegistry } from '../registry/index.js';

const DEFAULT_TIMEOUT_MS = 100;

export class EmbeddingSearcher {
  private modelManager: ModelManager;
  private registry: UnifiedRegistry;
  private provider: any = null;
  private index = new ToolEmbeddingIndex();
  private initialized = false;

  constructor(modelManager: ModelManager, registry: UnifiedRegistry) {
    this.modelManager = modelManager;
    this.registry = registry;
  }

  /** True if ONNX model is loaded and ready. */
  get isAvailable(): boolean {
    if (!this.initialized) this.tryInit();
    return this.provider !== null && this.index.isBuilt;
  }

  /** Search tools by embedding similarity. Returns [toolName, score] or null. */
  search(query: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): [string, number] | null {
    if (!this.isAvailable) return null;
    const start = performance.now();
    try {
      const queryVec = this.provider.embed(query);
      if (!queryVec) return null;
      const elapsed = performance.now() - start;
      if (elapsed > timeoutMs) {
        console.error(`[embedding-searcher] Timeout: ${elapsed.toFixed(0)}ms > ${timeoutMs}ms`);
        return null;
      }
      const results = this.index.search(queryVec, 1);
      if (results.length === 0) return null;
      return results[0];
    } catch (e: any) {
      console.error(`[embedding-searcher] Search error: ${e.message}`);
      return null;
    }
  }

  /** Rebuild tool embedding index (after model switch or new tools). */
  rebuildIndex(): void {
    if (!this.provider) this.tryInit();
    if (!this.provider) return;
    this.index.build(this.registry, (text: string) => this.provider.embed(text));
  }

  private tryInit(): void {
    this.initialized = true;
    try {
      const provider = this.createProvider();
      if (!provider || !provider.isAvailable()) return;
      this.provider = provider;
      this.index.build(this.registry, (text: string) => provider.embed(text));
    } catch (e: any) {
      console.error(`[embedding-searcher] Init failed: ${e.message}`);
    }
  }

  private createProvider(): any {
    try {
      // Try to load ONNX provider from memory module
      const modelPath = this.modelManager.getActiveModelPath();
      let modelFile = path.join(modelPath, 'model.onnx');
      let vocabFile = path.join(modelPath, 'vocab.txt');
      if (!fs.existsSync(modelFile)) {
        const altPath = path.join(
          process.env.HOME ?? process.env.USERPROFILE ?? '~', '.code-intel', 'models'
        );
        modelFile = path.join(altPath, 'model.onnx');
        vocabFile = path.join(altPath, 'vocab.txt');
      }
      if (!fs.existsSync(modelFile)) return null;
      // Dynamic import of ONNX provider (optional dependency)
      const { OnnxEmbeddingProvider } = require('../../memory/embedding/onnx-provider.js');
      return new OnnxEmbeddingProvider(modelFile, vocabFile);
    } catch {
      console.error('[embedding-searcher] ONNX runtime not available — embedding disabled');
      return null;
    }
  }
}
