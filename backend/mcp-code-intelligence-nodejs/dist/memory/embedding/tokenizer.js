"use strict";
/**
 * WordPiece tokenizer for all-MiniLM-L6-v2 model.
 * Port of Python tokenizer.py — loads vocab.txt, encodes text.
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
exports.Tokenizer = void 0;
const fs = __importStar(require("fs"));
class Tokenizer {
    vocab;
    clsId;
    sepId;
    unkId;
    padId;
    constructor(vocabPath) {
        if (!fs.existsSync(vocabPath)) {
            throw new Error(`Vocab file not found: ${vocabPath}`);
        }
        this.vocab = this.loadVocab(vocabPath);
        this.clsId = this.vocab.get('[CLS]') ?? 101;
        this.sepId = this.vocab.get('[SEP]') ?? 102;
        this.unkId = this.vocab.get('[UNK]') ?? 100;
        this.padId = this.vocab.get('[PAD]') ?? 0;
        log(`Tokenizer loaded: ${this.vocab.size} tokens`);
    }
    /** Tokenize text into input_ids, attention_mask, token_type_ids. */
    encode(text, maxLength = 128) {
        const tokens = this.tokenize(text);
        const truncated = tokens.slice(0, maxLength - 2);
        const ids = [this.clsId];
        for (const t of truncated) {
            ids.push(this.vocab.get(t) ?? this.unkId);
        }
        ids.push(this.sepId);
        const mask = new Array(ids.length).fill(1);
        const typeIds = new Array(ids.length).fill(0);
        // Pad to maxLength
        const padCount = maxLength - ids.length;
        for (let i = 0; i < padCount; i++) {
            ids.push(this.padId);
            mask.push(0);
            typeIds.push(0);
        }
        return {
            inputIds: BigInt64Array.from(ids.map(BigInt)),
            attentionMask: BigInt64Array.from(mask.map(BigInt)),
            tokenTypeIds: BigInt64Array.from(typeIds.map(BigInt)),
        };
    }
    /** Split text into WordPiece tokens. */
    tokenize(text) {
        const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        const tokens = [];
        for (const word of words) {
            tokens.push(...this.wordpieceTokenize(word));
        }
        return tokens;
    }
    /** Greedy longest-match WordPiece for a single word. */
    wordpieceTokenize(word) {
        const pieces = [];
        let start = 0;
        while (start < word.length) {
            let end = word.length;
            let found = null;
            while (start < end) {
                const sub = start === 0 ? word.slice(start, end) : `##${word.slice(start, end)}`;
                if (this.vocab.has(sub)) {
                    found = sub;
                    break;
                }
                end--;
            }
            if (found === null) {
                pieces.push('[UNK]');
                break;
            }
            pieces.push(found);
            start = end;
        }
        return pieces;
    }
    /** Load vocab.txt — line index = token id. */
    loadVocab(vocabPath) {
        const vocab = new Map();
        const content = fs.readFileSync(vocabPath, 'utf-8');
        const lines = content.split('\n');
        for (let idx = 0; idx < lines.length; idx++) {
            const token = lines[idx].trim();
            if (token)
                vocab.set(token, idx);
        }
        return vocab;
    }
}
exports.Tokenizer = Tokenizer;
function log(msg) {
    process.stderr.write(`[tokenizer] ${msg}\n`);
}
//# sourceMappingURL=tokenizer.js.map