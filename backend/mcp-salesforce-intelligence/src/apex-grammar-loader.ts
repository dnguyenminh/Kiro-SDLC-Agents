/**
 * KSA-191: Apex grammar (.wasm) loader utility.
 * Helps locate and load the tree-sitter-apex.wasm file from various paths.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Default search paths for tree-sitter-apex.wasm (relative to caller). */
const WASM_SEARCH_PATHS = [
  // Inside mcp-code-intelligence-nodejs dist/parsers/grammars/
  '../parsers/grammars/tree-sitter-apex.wasm',
  // Inside mcp-code-intelligence-nodejs src/parsers/grammars/
  '../../src/parsers/grammars/tree-sitter-apex.wasm',
  // salesforce-ast npm package
  '../node_modules/salesforce-ast/grammars/tree-sitter-apex.wasm',
  '../../node_modules/salesforce-ast/grammars/tree-sitter-apex.wasm',
];

/**
 * Get the absolute path to tree-sitter-apex.wasm, searching common locations.
 * @param baseDir - Directory to resolve relative paths from. Defaults to __dirname.
 * @returns Absolute path to .wasm file, or null if not found.
 */
export function getApexWasmPath(baseDir?: string): string | null {
  const resolveFrom = baseDir ?? __dirname;

  for (const searchPath of WASM_SEARCH_PATHS) {
    const resolved = path.resolve(resolveFrom, searchPath);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  return null;
}

/**
 * Check if the Apex tree-sitter grammar is available.
 * @param baseDir - Directory to resolve relative paths from.
 */
export function isApexGrammarAvailable(baseDir?: string): boolean {
  return getApexWasmPath(baseDir) !== null;
}

/**
 * Load the Apex .wasm grammar file contents as a Buffer.
 * Used by tree-sitter to initialize the Apex language.
 * @param baseDir - Directory to resolve relative paths from.
 * @returns Buffer containing .wasm file, or null if not found.
 */
export function loadApexGrammar(baseDir?: string): Buffer | null {
  const wasmPath = getApexWasmPath(baseDir);
  if (!wasmPath) {
    console.error('[apex-grammar-loader] tree-sitter-apex.wasm not found');
    return null;
  }

  try {
    return fs.readFileSync(wasmPath);
  } catch (err) {
    console.error(`[apex-grammar-loader] Failed to read ${wasmPath}:`, err);
    return null;
  }
}
