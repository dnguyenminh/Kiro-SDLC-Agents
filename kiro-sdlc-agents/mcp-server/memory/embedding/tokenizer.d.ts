/**
 * WordPiece tokenizer for all-MiniLM-L6-v2 model.
 * Port of Python tokenizer.py — loads vocab.txt, encodes text.
 */
/** Tokenized output with padded arrays. */
export interface TokenizedInput {
    inputIds: BigInt64Array;
    attentionMask: BigInt64Array;
    tokenTypeIds: BigInt64Array;
}
export declare class Tokenizer {
    private readonly vocab;
    private readonly clsId;
    private readonly sepId;
    private readonly unkId;
    private readonly padId;
    constructor(vocabPath: string);
    /** Tokenize text into input_ids, attention_mask, token_type_ids. */
    encode(text: string, maxLength?: number): TokenizedInput;
    /** Split text into WordPiece tokens. */
    private tokenize;
    /** Greedy longest-match WordPiece for a single word. */
    private wordpieceTokenize;
    /** Load vocab.txt — line index = token id. */
    private loadVocab;
}
//# sourceMappingURL=tokenizer.d.ts.map