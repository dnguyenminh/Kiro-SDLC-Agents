/**
 * Model catalog — known embedding models with metadata.
 */

export interface ModelInfo {
  displayName: string;
  sizeMb: number;
  languages: string[];
  vocabSize: number;
  dimensions: number;
  baseUrl: string;
  files: Record<string, string>;
}

export const MODELS: Record<string, ModelInfo> = {
  'all-MiniLM-L6-v2': {
    displayName: 'English (Small, Fast)',
    sizeMb: 90,
    languages: ['en'],
    vocabSize: 30522,
    dimensions: 384,
    baseUrl: 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main',
    files: { model: 'onnx/model.onnx', vocab: 'vocab.txt' },
  },
  'paraphrase-multilingual-MiniLM-L12-v2': {
    displayName: 'Multilingual (50+ languages)',
    sizeMb: 470,
    languages: ['en', 'vi', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'ar', 'ru'],
    vocabSize: 250002,
    dimensions: 384,
    baseUrl: 'https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main',
    files: { model: 'onnx/model.onnx', vocab: 'sentencepiece.bpe.model' },
  },
};

export const DEFAULT_MODEL = 'all-MiniLM-L6-v2';

/** Get model metadata by name. */
export function getModelInfo(name: string): ModelInfo | null {
  return MODELS[name] ?? null;
}

/** List all known models with metadata. */
export function listModels(): Array<{ name: string } & ModelInfo> {
  return Object.entries(MODELS).map(([name, info]) => ({ name, ...info }));
}
