"use strict";
/**
 * Model catalog — known embedding models with metadata.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MODEL = exports.MODELS = void 0;
exports.getModelInfo = getModelInfo;
exports.listModels = listModels;
exports.MODELS = {
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
exports.DEFAULT_MODEL = 'all-MiniLM-L6-v2';
/** Get model metadata by name. */
function getModelInfo(name) {
    return exports.MODELS[name] ?? null;
}
/** List all known models with metadata. */
function listModels() {
    return Object.entries(exports.MODELS).map(([name, info]) => ({ name, ...info }));
}
//# sourceMappingURL=model-catalog.js.map