/**
 * KSA-191: Apex grammar (.wasm) loader utility.
 * Helps locate and load the tree-sitter-apex.wasm file from various paths.
 */
/**
 * Get the absolute path to tree-sitter-apex.wasm, searching common locations.
 * @param baseDir - Directory to resolve relative paths from. Defaults to __dirname.
 * @returns Absolute path to .wasm file, or null if not found.
 */
export declare function getApexWasmPath(baseDir?: string): string | null;
/**
 * Check if the Apex tree-sitter grammar is available.
 * @param baseDir - Directory to resolve relative paths from.
 */
export declare function isApexGrammarAvailable(baseDir?: string): boolean;
/**
 * Load the Apex .wasm grammar file contents as a Buffer.
 * Used by tree-sitter to initialize the Apex language.
 * @param baseDir - Directory to resolve relative paths from.
 * @returns Buffer containing .wasm file, or null if not found.
 */
export declare function loadApexGrammar(baseDir?: string): Buffer | null;
//# sourceMappingURL=apex-grammar-loader.d.ts.map