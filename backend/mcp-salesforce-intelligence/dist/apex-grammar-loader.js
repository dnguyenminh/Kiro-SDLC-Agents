"use strict";
/**
 * KSA-191: Apex grammar (.wasm) loader utility.
 * Helps locate and load the tree-sitter-apex.wasm file from various paths.
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
exports.getApexWasmPath = getApexWasmPath;
exports.isApexGrammarAvailable = isApexGrammarAvailable;
exports.loadApexGrammar = loadApexGrammar;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
function getApexWasmPath(baseDir) {
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
function isApexGrammarAvailable(baseDir) {
    return getApexWasmPath(baseDir) !== null;
}
/**
 * Load the Apex .wasm grammar file contents as a Buffer.
 * Used by tree-sitter to initialize the Apex language.
 * @param baseDir - Directory to resolve relative paths from.
 * @returns Buffer containing .wasm file, or null if not found.
 */
function loadApexGrammar(baseDir) {
    const wasmPath = getApexWasmPath(baseDir);
    if (!wasmPath) {
        console.error('[apex-grammar-loader] tree-sitter-apex.wasm not found');
        return null;
    }
    try {
        return fs.readFileSync(wasmPath);
    }
    catch (err) {
        console.error(`[apex-grammar-loader] Failed to read ${wasmPath}:`, err);
        return null;
    }
}
//# sourceMappingURL=apex-grammar-loader.js.map