/**
 * ModelRegistry — tracks downloaded models and active selection via registry.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_MODEL } from './model-catalog.js';

const REGISTRY_FILE = 'registry.json';

export class ModelRegistry {
  private dir: string;
  private filePath: string;
  private data: Record<string, any> | null = null;

  constructor(modelsDir: string) {
    this.dir = modelsDir;
    this.filePath = path.join(modelsDir, REGISTRY_FILE);
  }

  get activeModel(): string {
    this.data = null; // Invalidate cache — external tools may update registry
    return this.loadData().active_model ?? DEFAULT_MODEL;
  }

  get modelsDir(): string { return this.dir; }

  /** Check if a model is marked as downloaded. */
  isDownloaded(modelName: string): boolean {
    const data = this.loadData();
    return modelName in (data.models ?? {});
  }

  /** Get path for a specific model. */
  modelPath(modelName: string): string {
    return path.join(this.dir, modelName);
  }

  /** Mark a model as downloaded in registry. */
  markDownloaded(modelName: string, sizeBytes: number): void {
    const data = this.loadData();
    if (!data.models) data.models = {};
    data.models[modelName] = {
      path: this.modelPath(modelName),
      downloaded_at: nowIso(),
      size_bytes: sizeBytes,
    };
    data.last_updated = nowIso();
    this.save(data);
  }

  /** Set the active model. */
  setActive(modelName: string): void {
    const data = this.loadData();
    data.active_model = modelName;
    data.last_updated = nowIso();
    this.save(data);
    console.error(`[model-registry] Active model set to: ${modelName}`);
  }

  /** Get all downloaded model entries. */
  getDownloadedModels(): Record<string, any> {
    return this.loadData().models ?? {};
  }

  private loadData(): Record<string, any> {
    if (this.data !== null) return this.data;
    if (!fs.existsSync(this.filePath)) {
      this.data = { active_model: DEFAULT_MODEL, models: {} };
      return this.data;
    }
    try {
      const text = fs.readFileSync(this.filePath, 'utf-8');
      this.data = JSON.parse(text);
    } catch (e: any) {
      console.error(`[model-registry] Load failed: ${e.message}`);
      this.data = { active_model: DEFAULT_MODEL, models: {} };
    }
    return this.data!;
  }

  private save(data: Record<string, any>): void {
    this.data = data;
    try {
      if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e: any) {
      console.error(`[model-registry] Save failed: ${e.message}`);
    }
  }
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
