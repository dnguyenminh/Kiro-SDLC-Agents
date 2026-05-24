"use strict";
/**
 * ModelDownloader — auto-download HuggingFace ONNX models.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelDownloader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const MODEL_FILE = 'model.onnx';
const VOCAB_FILE = 'vocab.txt';
const BASE_URL = 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main';
class ModelDownloader {
    modelsDir;
    constructor(modelsDir) {
        this.modelsDir = modelsDir;
    }
    get modelPath() { return path.join(this.modelsDir, MODEL_FILE); }
    get vocabPath() { return path.join(this.modelsDir, VOCAB_FILE); }
    /** Check if model files exist locally. */
    isModelPresent() {
        return fs.existsSync(this.modelPath) && fs.existsSync(this.vocabPath);
    }
    /** Download model files from HuggingFace. Returns true on success. */
    async downloadIfMissing() {
        if (this.isModelPresent())
            return true;
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
    downloadFile(url, target) {
        if (fs.existsSync(target))
            return Promise.resolve(true);
        console.error(`[model] Downloading: ${url}`);
        return new Promise((resolve) => {
            const file = fs.createWriteStream(target);
            https.get(url, { timeout: 300_000 }, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    file.close();
                    fs.unlinkSync(target);
                    this.downloadFile(res.headers.location, target).then(resolve);
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
                if (fs.existsSync(target))
                    fs.unlinkSync(target);
                resolve(false);
            });
        });
    }
}
exports.ModelDownloader = ModelDownloader;
//# sourceMappingURL=model-downloader.js.map