"use strict";
/**
 * KSA-155: File Resolver - resolves import paths to indexed file paths.
 * Handles relative imports, bare specifiers, and extension resolution.
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
exports.FileResolver = void 0;
const path = __importStar(require("path"));
class FileResolver {
    indexedFiles;
    workspaceRoot;
    static EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx', '.kt', '.py', '/index.ts', '/index.js'];
    static STDLIB_MODULES = new Set([
        // Node.js
        'fs', 'path', 'http', 'https', 'url', 'crypto', 'os', 'util', 'stream', 'events',
        'child_process', 'cluster', 'net', 'dns', 'tls', 'readline', 'zlib', 'buffer',
        'assert', 'querystring', 'string_decoder', 'timers', 'vm', 'worker_threads',
        // Python
        'sys', 'json', 're', 'math', 'datetime', 'collections', 'itertools',
        'functools', 'typing', 'pathlib', 'abc', 'dataclasses', 'enum', 'logging',
        'unittest', 'io', 'subprocess', 'threading', 'multiprocessing',
    ]);
    constructor(db, workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.indexedFiles = this.loadIndexedFiles(db);
    }
    loadIndexedFiles(db) {
        const rows = db.prepare('SELECT relative_path FROM files').all();
        return new Set(rows.map(r => r.relative_path));
    }
    /** Resolve an input file path to a canonical indexed path. */
    resolveFile(input) {
        // Exact match on relative path
        if (this.indexedFiles.has(input))
            return input;
        // Try normalizing separators
        const normalized = input.replace(/\\/g, '/');
        if (this.indexedFiles.has(normalized))
            return normalized;
        // Try stripping workspace root prefix
        if (input.startsWith(this.workspaceRoot)) {
            const relative = input.substring(this.workspaceRoot.length).replace(/^[/\\]/, '').replace(/\\/g, '/');
            if (this.indexedFiles.has(relative))
                return relative;
        }
        // Try with extensions
        const withExt = this.findWithExtensions(normalized);
        if (withExt)
            return withExt;
        // Fuzzy: find by basename
        const basename = path.basename(input);
        const matches = [...this.indexedFiles].filter(f => f.endsWith(basename) || f.endsWith('/' + basename));
        if (matches.length === 1)
            return matches[0];
        return null;
    }
    /** Resolve an import target relative to a source file. */
    resolveImportTarget(sourceFile, target) {
        if (target.startsWith('.')) {
            const dir = path.dirname(sourceFile).replace(/\\/g, '/');
            const resolved = path.posix.resolve('/' + dir, target).substring(1);
            return this.findWithExtensions(resolved);
        }
        // Try as workspace-relative path
        return this.findWithExtensions(target);
    }
    /** Check if a target is an external (non-project) dependency. */
    isExternal(target) {
        const base = target.split('/')[0].split('.')[0];
        if (FileResolver.STDLIB_MODULES.has(base))
            return true;
        // Bare specifier that doesn't start with . or /
        if (!target.startsWith('.') && !target.startsWith('/')) {
            const resolved = this.resolveImportTarget('', target);
            return resolved === null;
        }
        return false;
    }
    /** Refresh the indexed files set (call after re-indexing). */
    refresh(db) {
        this.indexedFiles = this.loadIndexedFiles(db);
    }
    findWithExtensions(basePath) {
        // Try exact first
        if (this.indexedFiles.has(basePath))
            return basePath;
        for (const ext of FileResolver.EXTENSIONS) {
            const candidate = basePath + ext;
            if (this.indexedFiles.has(candidate))
                return candidate;
        }
        return null;
    }
}
exports.FileResolver = FileResolver;
//# sourceMappingURL=file-resolver.js.map