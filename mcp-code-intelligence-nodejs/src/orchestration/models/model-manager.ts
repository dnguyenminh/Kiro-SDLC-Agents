/**
 * ModelManager — MCP tool for model lifecycle (list, download, status, switch).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { DEFAULT_MODEL, getModelInfo, listModels } from './model-catalog.js';
import { ModelRegistry } from './model-registry.js';

const GLOBAL_MODELS_DIR = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? '~', '.code-intel', 'models'
);

export class ModelManager {
  private registry: ModelRegistry;
  private downloading = new Set<string>();

  constructor(modelsDir?: string) {
    this.registry = new ModelRegistry(modelsDir ?? GLOBAL_MODELS_DIR);
  }

  /** Handle action: list, download, status, switch. */
  execute(args: Record<string, any>): string {
    const action = (args.action ?? '').toLowerCase();
    const handlers: Record<string, (a: Record<string, any>) => string> = {
      list: (a) => this.handleList(a),
      download: (a) => this.handleDownload(a),
      status: (a) => this.handleStatus(a),
      switch: (a) => this.handleSwitch(a),
    };
    const handler = handlers[action];
    if (!handler) return JSON.stringify({ error: 'INVALID_ACTION', message: 'Use: list, download, status, switch' });
    return handler(args);
  }

  getActiveModel(): string { return this.registry.activeModel; }
  getActiveModelPath(): string { return this.registry.modelPath(this.registry.activeModel); }

  /** Background download of default model on first need. */
  autoDownloadIfNeeded(): void {
    const modelName = DEFAULT_MODEL;
    const modelFile = path.join(this.registry.modelPath(modelName), 'model.onnx');
    if (fs.existsSync(modelFile)) return;
    if (this.downloading.has(modelName)) return;
    this.backgroundDownload(modelName);
  }

  private handleList(_args: Record<string, any>): string {
    const models = listModels().map((m) => ({
      ...m, downloaded: this.registry.isDownloaded(m.name), active: m.name === this.registry.activeModel,
    }));
    return JSON.stringify({ models });
  }

  private handleDownload(args: Record<string, any>): string {
    const modelName = args.model_name ?? '';
    const info = getModelInfo(modelName);
    if (!info) return JSON.stringify({ error: 'MODEL_NOT_FOUND', message: `Unknown model: ${modelName}` });
    return this.doDownload(modelName, info);
  }

  private handleStatus(_args: Record<string, any>): string {
    const active = this.registry.activeModel;
    const info = getModelInfo(active);
    return JSON.stringify({
      active_model: active, model_path: this.registry.modelPath(active),
      dimensions: info?.dimensions ?? 384, languages: info?.languages ?? [],
    });
  }

  private handleSwitch(args: Record<string, any>): string {
    const modelName = args.model_name ?? '';
    if (!getModelInfo(modelName)) return JSON.stringify({ error: 'MODEL_NOT_FOUND', message: `Unknown: ${modelName}` });
    if (!this.registry.isDownloaded(modelName)) return JSON.stringify({ error: 'MODEL_NOT_DOWNLOADED', message: 'Download first' });
    this.registry.setActive(modelName);
    return JSON.stringify({ success: true, active_model: modelName });
  }

  private doDownload(modelName: string, info: any): string {
    const modelDir = this.registry.modelPath(modelName);
    if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });
    // Synchronous download not practical in Node — mark as pending
    console.error(`[model-manager] Download requested: ${modelName} (use autoDownloadIfNeeded for background)`);
    this.backgroundDownload(modelName);
    return JSON.stringify({ success: true, model: modelName, path: modelDir, status: 'downloading' });
  }

  private backgroundDownload(modelName: string): void {
    if (this.downloading.has(modelName)) return;
    this.downloading.add(modelName);
    const info = getModelInfo(modelName);
    if (!info) { this.downloading.delete(modelName); return; }
    console.error(`[model-manager] Auto-downloading: ${modelName}`);
    const modelDir = this.registry.modelPath(modelName);
    if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });
    this.downloadFiles(modelName, info, modelDir).finally(() => this.downloading.delete(modelName));
  }

  private async downloadFiles(modelName: string, info: any, modelDir: string): Promise<void> {
    for (const [_key, relPath] of Object.entries(info.files as Record<string, string>)) {
      const url = `${info.baseUrl}/${relPath}`;
      const target = path.join(modelDir, path.basename(relPath));
      if (fs.existsSync(target)) continue;
      try {
        await this.downloadFile(url, target);
      } catch (e: any) {
        console.error(`[model-manager] Download failed: ${e.message}`);
        return;
      }
    }
    const size = fs.readdirSync(modelDir).reduce((sum, f) => {
      const stat = fs.statSync(path.join(modelDir, f));
      return sum + (stat.isFile() ? stat.size : 0);
    }, 0);
    this.registry.markDownloaded(modelName, size);
    console.error(`[model-manager] Download complete: ${modelName}`);
  }

  private downloadFile(url: string, target: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          this.downloadFile(res.headers.location!, target).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
        const ws = fs.createWriteStream(target);
        res.pipe(ws);
        ws.on('finish', () => { ws.close(); resolve(); });
        ws.on('error', reject);
      }).on('error', reject);
    });
  }
}
