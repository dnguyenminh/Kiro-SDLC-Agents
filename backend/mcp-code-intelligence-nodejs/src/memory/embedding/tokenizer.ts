/**
 * WordPiece tokenizer for all-MiniLM-L6-v2 model.
 * Port of Python tokenizer.py — loads vocab.txt, encodes text.
 */

import * as fs from 'fs';

/** Tokenized output with padded arrays. */
export interface TokenizedInput {
  inputIds: BigInt64Array;
  attentionMask: BigInt64Array;
  tokenTypeIds: BigInt64Array;
}

export class Tokenizer {
  private readonly vocab: Map<string, number>;
  private readonly clsId: number;
  private readonly sepId: number;
  private readonly unkId: number;
  private readonly padId: number;

  constructor(vocabPath: string) {
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
  encode(text: string, maxLength = 128): TokenizedInput {
    const tokens = this.tokenize(text);
    const truncated = tokens.slice(0, maxLength - 2);

    const ids: number[] = [this.clsId];
    for (const t of truncated) {
      ids.push(this.vocab.get(t) ?? this.unkId);
    }
    ids.push(this.sepId);

    const mask: number[] = new Array(ids.length).fill(1);
    const typeIds: number[] = new Array(ids.length).fill(0);

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
  private tokenize(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const tokens: string[] = [];
    for (const word of words) {
      tokens.push(...this.wordpieceTokenize(word));
    }
    return tokens;
  }

  /** Greedy longest-match WordPiece for a single word. */
  private wordpieceTokenize(word: string): string[] {
    const pieces: string[] = [];
    let start = 0;
    while (start < word.length) {
      let end = word.length;
      let found: string | null = null;
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
  private loadVocab(vocabPath: string): Map<string, number> {
    const vocab = new Map<string, number>();
    const content = fs.readFileSync(vocabPath, 'utf-8');
    const lines = content.split('\n');
    for (let idx = 0; idx < lines.length; idx++) {
      const token = lines[idx].trim();
      if (token) vocab.set(token, idx);
    }
    return vocab;
  }
}

function log(msg: string): void {
  process.stderr.write(`[tokenizer] ${msg}\n`);
}
