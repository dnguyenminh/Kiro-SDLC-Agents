"use strict";
/**
 * FileTreeProvider — Workspace file and folder tree resolution
 * KSA-252
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
exports.FileTreeProvider = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
    '.vscode', '.idea', 'coverage', '.cache', '.code-intel',
]);
const MAX_FILES = 200;
class FileTreeProvider {
    workspaceRoot;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    async getTree(maxDepth = 4) {
        return this.scanDir(this.workspaceRoot, 0, maxDepth);
    }
    async getFolderTree(maxDepth = 4) {
        return this.scanFolders(this.workspaceRoot, 0, maxDepth);
    }
    async readFiles(relativePaths) {
        const results = [];
        for (const relPath of relativePaths) {
            const fullPath = path.join(this.workspaceRoot, relPath);
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                results.push({ path: relPath, content });
            }
            catch {
                results.push({ path: relPath, content: '[Error reading file]' });
            }
        }
        return results;
    }
    async listFolder(folderPath) {
        const fullPath = path.join(this.workspaceRoot, folderPath);
        try {
            const entries = fs.readdirSync(fullPath, { withFileTypes: true });
            return entries.map(e => e.isDirectory() ? `${e.name}/` : e.name);
        }
        catch {
            return [];
        }
    }
    scanDir(dirPath, depth, maxDepth) {
        if (depth >= maxDepth)
            return [];
        let entries;
        try {
            entries = fs.readdirSync(dirPath, { withFileTypes: true });
        }
        catch {
            return [];
        }
        const results = [];
        let fileCount = 0;
        for (const entry of entries) {
            if (fileCount >= MAX_FILES)
                break;
            if (entry.name.startsWith('.') && IGNORE_DIRS.has(entry.name))
                continue;
            if (IGNORE_DIRS.has(entry.name))
                continue;
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(this.workspaceRoot, fullPath).replace(/\\/g, '/');
            if (entry.isDirectory()) {
                const children = this.scanDir(fullPath, depth + 1, maxDepth);
                results.push({ name: entry.name, path: relativePath, type: 'directory', children });
            }
            else {
                results.push({ name: entry.name, path: relativePath, type: 'file' });
                fileCount++;
            }
        }
        return results;
    }
    scanFolders(dirPath, depth, maxDepth) {
        if (depth >= maxDepth)
            return [];
        let entries;
        try {
            entries = fs.readdirSync(dirPath, { withFileTypes: true });
        }
        catch {
            return [];
        }
        const results = [];
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if (IGNORE_DIRS.has(entry.name))
                continue;
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(this.workspaceRoot, fullPath).replace(/\\/g, '/');
            const children = this.scanFolders(fullPath, depth + 1, maxDepth);
            results.push({ name: entry.name, path: relativePath, children });
        }
        return results;
    }
}
exports.FileTreeProvider = FileTreeProvider;
//# sourceMappingURL=FileTreeProvider.js.map