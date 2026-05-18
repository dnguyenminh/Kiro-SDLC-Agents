/**
 * ModelDownloader — auto-download HuggingFace ONNX models.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const MODEL_FILE = 'model.onnx';
const VOCAB_FILE = 'vocab.txt';
const BASE_URL = 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main';

export class ModelDownloader {
  private modelsDir: string;

  constructor(modelsDir: string) {
    this.modelsDir = modelsDir;
  }

  get modelPath(): string { return path.join(this.modelsDir, MODEL_FILE); }
  get vocabPath(): string { return path.join(this.modelsDir, VOCAB_FILE); }

  /** Check if model files exist locally. */
  isModelPresent(): boolean {
    return fs.existsSync(this.modelPath) && fs.existsSync(this.vocabPath);
  }

  /** Download model files from HuggingFace. Returns true on success. */
  async downloadIfMissing(): Promise<boolean> {
    if (this.isModelPresent()) return true;
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
    const modelOk = await this.downloadFile(`${BASE_URL}/onnx/model.onnx`, this.modelPath);
    const vocabOk = await this.downloadFile(`${BASE_URL}/vocab.txt`, this.vocabPath);
    if (modelOk && vocabOk) {
      console.error(`[model] Downloaded to ${this.modelsDir}`);
    }
    return modelOk && vocabOk;
  }

  private downloadFile(url: string, target: string): Promise<boolean> {
    if (fs.existsSync(target)) return Promise.resolve(true);
    console.error(`[model] Downloading: ${url}`);
    return new Promise((resolve) => {
      const file = fs.createWriteStream(target);
      https.get(url, { timeout: 300_000 }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlinkSync(target);
          this.downloadFile(res.headers.location!, target).then(resolve);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(target);
          resolve(false);
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(true); });
      }).on('error', () => {
        file.close();
        if (fs.existsSync(target)) fs.unlinkSync(target);
        resolve(false);
      });
    });
  }
}
