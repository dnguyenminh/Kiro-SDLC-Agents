/**
 * Signature Extractor — Multi-language regex-based symbol extraction.
 * Extracts functions, classes, interfaces, and other symbols from source files.
 */
export interface ExtractedSymbol {
    name: string;
    kind: SymbolKind;
    signature: string;
    startLine: number;
    endLine: number;
    parentSymbol: string | null;
    visibility: string | null;
    docComment: string | null;
}
export type SymbolKind = 'function' | 'class' | 'interface' | 'method' | 'enum' | 'type' | 'constant' | 'variable' | 'module' | 'namespace' | 'trait' | 'struct';
/** Extract symbols from source content based on language. */
export declare function extractSymbols(content: string, language: string): ExtractedSymbol[];
